"""
Turns a product photo into a shop-ready image: white square, product centred.

If the photo's background is already plain white it is only squared; otherwise the background is removed with
InSPyReNet (the MIT-licensed transparent-background package, "fast" mode) and the product is placed on white.
"fast" works at 384px and needs ~1.6 GB; rembg's BiRefNet needed over 5 GB on CPU and its ISNet dropped dark keyboards.

Endpoints (all but /health need the X-Service-Token header):
  POST /process   image as multipart field "image", or form/JSON field "url" (Instagram/Avechi/nickleecoke images only)
                  options: mode=auto|remove|keep (default auto), size=1000, format=jpg|png (png = transparent cutout),
                           padding=0.06 (fraction of the square left around the product)
                  returns the image; headers X-Background (plain|removed|kept) and X-Edge-White (share of white edge pixels)
  POST /check     same input; returns JSON {"plain": bool, "edgeWhite": 0.97} without changing anything

Environment:
  SERVICE_TOKEN   shared secret (required)
  TB_MODE         transparent-background mode (default fast; "base" is sharper but needs over 3 GB)
  WHITE_EDGE      share of near-white edge pixels that counts as a plain background (default 0.92)
"""
import io
import ipaddress
import os
import socket
import threading
from urllib.parse import urlparse

import cv2
import numpy as np
import requests
import torch
from flask import Flask, jsonify, request, send_file
from PIL import Image, ImageOps
from transparent_background import Remover

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 60_000_000

SERVICE_TOKEN = os.environ.get("SERVICE_TOKEN", "")
MODEL = os.environ.get("TB_MODE", "fast")
WHITE_EDGE = float(os.environ.get("WHITE_EDGE", "0.92"))
MAX_INPUT_SIDE = 2048  # bigger photos are scaled down first; the mask is computed small and scaled back up
URL_HOSTS = ("cdninstagram.com", "fbcdn.net", "avechi.co.ke", "nickleecoke.vercel.app", "images.nicklee.co.ke")

torch.set_num_threads(int(os.environ.get("THREADS", "2")))
_remover = Remover(mode=MODEL, device="cpu")
_lock = threading.Lock()  # one removal at a time keeps memory predictable on the shared server


def authorized() -> bool:
    return bool(SERVICE_TOKEN) and request.headers.get("X-Service-Token") == SERVICE_TOKEN


def public_host(host: str) -> bool:
    try:
        return all(ipaddress.ip_address(info[4][0]).is_global for info in socket.getaddrinfo(host, 443))
    except OSError:
        return False


def load_input() -> Image.Image:
    data = request.get_json(silent=True) or {}
    if "image" in request.files:
        raw = request.files["image"].read()
    else:
        url = (request.form.get("url") or data.get("url") or "").strip()
        host = (urlparse(url).hostname or "").lower()
        if urlparse(url).scheme not in ("http", "https") or not any(host == h or host.endswith("." + h) for h in URL_HOSTS):
            raise ValueError(f"send an image file, or a url on {', '.join(URL_HOSTS)}")
        if not public_host(host):
            raise ValueError("url host doesn't resolve to a public address")
        response = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
        response.raise_for_status()
        raw = response.content
    image = ImageOps.exif_transpose(Image.open(io.BytesIO(raw)))
    image.thumbnail((MAX_INPUT_SIDE, MAX_INPUT_SIDE))
    return image.convert("RGBA")


def option(name: str, default: str) -> str:
    data = request.get_json(silent=True) or {}
    return str(request.values.get(name) or data.get(name) or default).lower()


def edge_white(image: Image.Image) -> float:
    """Share of pixels in a thin border that are near-white and colourless (a studio/white background)."""
    rgb = image.convert("RGB")
    rgb.thumbnail((400, 400))
    w, h = rgb.size
    band = max(2, round(min(w, h) * 0.03))
    px = rgb.load()
    edge = [px[x, y] for y in range(h) for x in range(w) if x < band or y < band or x >= w - band or y >= h - band]
    white = sum(1 for r, g, b in edge if min(r, g, b) >= 232 and max(r, g, b) - min(r, g, b) <= 18)
    return white / len(edge)


def remove_background(image: Image.Image) -> Image.Image:
    """Cut the product out, then drop specks: mask pieces under 3% of the largest piece (bits of shelf, lamps)."""
    with _lock:
        cutout = _remover.process(image.convert("RGB"), type="rgba")
    alpha = np.array(cutout.getchannel("A"))
    count, labels, stats, _ = cv2.connectedComponentsWithStats((alpha > 128).astype(np.uint8), connectivity=8)
    if count > 2:
        areas = stats[1:, cv2.CC_STAT_AREA]
        keep = np.isin(labels, 1 + np.flatnonzero(areas >= areas.max() * 0.03)).astype(np.uint8)
        near = cv2.dilate(keep, np.ones((9, 9), np.uint8)) > 0  # kept pieces plus their soft edges
        alpha = np.where(near, alpha, 0)
        cutout.putalpha(Image.fromarray(alpha.astype(np.uint8)))
    return cutout


def square(image: Image.Image, size: int, padding: float, transparent: bool) -> Image.Image:
    """Crop to the product (non-transparent, or non-white for a kept photo) and centre it on a square."""
    alpha_box = image.getchannel("A").point(lambda a: 255 if a > 10 else 0).getbbox()
    if alpha_box and alpha_box != (0, 0, *image.size):
        box = alpha_box
    else:  # opaque photo: trim the white margin around the product
        box = ImageOps.invert(image.convert("L")).point(lambda v: 255 if v > 20 else 0).getbbox() or (0, 0, *image.size)
    product = image.crop(box)
    inner = round(size * (1 - 2 * padding))
    scale = inner / max(product.size)  # shrink big products, enlarge small ones, to fill the square
    product = product.resize((max(1, round(product.width * scale)), max(1, round(product.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 0 if transparent else 255))
    canvas.alpha_composite(product, ((size - product.width) // 2, (size - product.height) // 2))
    return canvas


@app.get("/health")
def health():
    return jsonify({"ok": True, "model": MODEL})


@app.post("/check")
def check():
    if not authorized():
        return jsonify({"error": "Unauthorized"}), 401
    try:
        share = edge_white(load_input())
    except Exception as error:
        return jsonify({"error": str(error)}), 400
    return jsonify({"plain": share >= WHITE_EDGE, "edgeWhite": round(share, 3)})


@app.post("/process")
def process():
    if not authorized():
        return jsonify({"error": "Unauthorized"}), 401
    try:
        image = load_input()
        mode = option("mode", "auto")
        fmt = option("format", "jpg")
        size = max(200, min(3000, int(option("size", "1000"))))
        padding = max(0.0, min(0.3, float(option("padding", "0.06"))))
    except Exception as error:
        return jsonify({"error": str(error)}), 400
    if mode not in ("auto", "remove", "keep") or fmt not in ("jpg", "jpeg", "png"):
        return jsonify({"error": "mode is auto|remove|keep and format is jpg|png"}), 400

    share = edge_white(image)
    if mode == "remove" or (mode == "auto" and share < WHITE_EDGE):
        image = remove_background(image)
        background = "removed"
    else:
        background = "plain" if share >= WHITE_EDGE else "kept"

    result = square(image, size, padding, transparent=fmt == "png")
    out = io.BytesIO()
    if fmt == "png":
        result.save(out, "PNG", optimize=True)
    else:
        result.convert("RGB").save(out, "JPEG", quality=90, optimize=True)
    out.seek(0)
    response = send_file(out, mimetype="image/png" if fmt == "png" else "image/jpeg", download_name=f"product.{'png' if fmt == 'png' else 'jpg'}")
    response.headers.update({"X-Background": background, "X-Edge-White": f"{share:.3f}"})
    return response


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
