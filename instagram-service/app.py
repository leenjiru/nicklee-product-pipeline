"""
Small Instaloader-backed service the Next.js app calls to find Instagram images.

Run it somewhere that can hold a long-lived process (a VPS, Fly.io, Railway, a home server) - not on Vercel.

Environment:
  SERVICE_TOKEN    shared secret the Next.js app sends in the X-Service-Token header (required)
  IG_PROFILES      comma-separated Instagram usernames to search, e.g. "nicklee_ke,hp_kenya" (required unless hashtags are used)
  IG_USER          Instagram login used for the session (strongly recommended; hashtag search needs it)
  IG_SESSIONFILE   path to a session file made with `instaloader --login=IG_USER` (preferred over a password)
  IG_PASSWORD      only if you have no session file
  IG_USE_HASHTAGS  "1" to also search the hashtag derived from the query (requires login)
  IG_MAX_POSTS     posts scanned per profile/hashtag (default 60)
  CACHE_SECONDS    how long identical searches are cached (default 600) - keep this high, Instagram rate limits hard
"""
import os
import re
import time
import threading
from typing import Any

import instaloader
from flask import Flask, jsonify, request

app = Flask(__name__)

SERVICE_TOKEN = os.environ.get("SERVICE_TOKEN", "")
PROFILES = [p.strip().lstrip("@") for p in os.environ.get("IG_PROFILES", "").split(",") if p.strip()]
MAX_POSTS = int(os.environ.get("IG_MAX_POSTS", "60"))
CACHE_SECONDS = int(os.environ.get("CACHE_SECONDS", "600"))
USE_HASHTAGS = os.environ.get("IG_USE_HASHTAGS") == "1"

_lock = threading.Lock()  # Instaloader's context isn't thread safe and we want to be gentle with Instagram
_cache: dict[str, tuple[float, Any]] = {}


def make_loader() -> instaloader.Instaloader:
    loader = instaloader.Instaloader(
        download_pictures=False, download_videos=False, download_video_thumbnails=False,
        download_geotags=False, download_comments=False, save_metadata=False,
        compress_json=False, quiet=True, max_connection_attempts=1,
    )
    user = os.environ.get("IG_USER")
    if user:
        session_file = os.environ.get("IG_SESSIONFILE")
        try:
            if session_file:
                loader.load_session_from_file(user, session_file)
            elif os.environ.get("IG_PASSWORD"):
                loader.login(user, os.environ["IG_PASSWORD"])
        except Exception as error:  # run anonymously rather than crash; most things will then be rate limited
            print(f"Instagram login failed: {error}", flush=True)
    return loader


L = make_loader()


def tokens(query: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", query.lower()) if len(t) > 1]


def post_to_item(post: instaloader.Post, owner: str) -> dict[str, Any]:
    images: list[str] = []
    if post.typename == "GraphSidecar":
        images = [node.display_url for node in post.get_sidecar_nodes() if not node.is_video]
    elif not post.is_video:
        images = [post.url]
    else:
        images = [post.url]  # a video's thumbnail
    return {
        "shortcode": post.shortcode,
        "permalink": f"https://www.instagram.com/p/{post.shortcode}/",
        "caption": (post.caption or "")[:1500],
        "date": post.date_utc.isoformat(),
        "owner": owner,
        "images": images[:10],
        "isVideo": bool(post.is_video),
    }


def matches(caption: str, words: list[str]) -> int:
    text = caption.lower()
    return sum(1 for w in words if w in text)


def scan(posts, owner: str, words: list[str], found: list[dict], limit: int):
    scanned = 0
    for post in posts:
        scanned += 1
        score = matches(post.caption or "", words)
        # require every word; a single-word query matches on that word
        if score == len(words):
            item = post_to_item(post, owner)
            item["score"] = score
            found.append(item)
        if scanned >= limit:
            break


@app.get("/health")
def health():
    return jsonify({"ok": True, "profiles": PROFILES, "loggedIn": bool(L.context.username)})


@app.get("/search")
def search():
    if not SERVICE_TOKEN or request.headers.get("X-Service-Token") != SERVICE_TOKEN:
        return jsonify({"error": "Unauthorized"}), 401
    query = (request.args.get("query") or "").strip()
    words = tokens(query)
    if not words:
        return jsonify({"error": "query is required"}), 400

    key = " ".join(words)
    cached = _cache.get(key)
    if cached and time.time() - cached[0] < CACHE_SECONDS:
        return jsonify({**cached[1], "cached": True})

    found: list[dict] = []
    errors: list[str] = []
    with _lock:
        for username in PROFILES:
            try:
                profile = instaloader.Profile.from_username(L.context, username)
                scan(profile.get_posts(), username, words, found, MAX_POSTS)
            except instaloader.exceptions.TooManyRequestsException:
                errors.append(f"@{username}: Instagram rate limit reached, try again later")
                break
            except Exception as error:
                errors.append(f"@{username}: {error}")
        if USE_HASHTAGS and L.context.username:
            tag = "".join(words)
            try:
                scan(instaloader.Hashtag.from_name(L.context, tag).get_posts(), f"#{tag}", words, found, MAX_POSTS)
            except Exception as error:
                errors.append(f"#{tag}: {error}")

    seen: set[str] = set()
    unique = [p for p in found if not (p["shortcode"] in seen or seen.add(p["shortcode"]))]
    unique.sort(key=lambda p: p["date"], reverse=True)
    payload = {"query": query, "posts": unique[:24], "errors": errors}
    if unique or not errors:  # don't cache pure failures
        _cache[key] = (time.time(), payload)
    return jsonify(payload)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
