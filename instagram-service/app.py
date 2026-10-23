"""
Small Instaloader-backed service the Next.js app calls to find Instagram images.

A query like "hp 840 g3" is run through Instagram's keyword search (the "For you" grid in the app,
which matches posts from any account), then topped up with posts from matching hashtags (#hp840g3
and #840g3) and, optionally, a fixed list of profiles.

Run it somewhere that can hold a long-lived process (a VPS, a home server) - not on Vercel.

Environment:
  SERVICE_TOKEN    shared secret the Next.js app sends in the X-Service-Token header (required)
  IG_SESSIONFILE   a session file in the session folder; every `session-<username>` file there is loaded, so
                   several spare accounts can be kept; they take turns per search and the rest cover when one is logged out
                   (add or refresh one with POST /session, which the site's /instagram/session page calls)
  IG_USER          with IG_PASSWORD, a password login used only when the folder has no session files
  IG_PASSWORD      see IG_USER
  IG_PROFILES      optional comma-separated usernames whose recent posts are also scanned
  IG_SEARCH_PAGES  pages of keyword-search results read per query (default 3)
  IG_MAX_TAGS      hashtags searched per query, built from the query words (default 3)
  IG_MAX_POSTS     posts read per hashtag/profile (default 24)
  TIME_BUDGET      seconds one search may spend talking to Instagram (default 40; the Next.js route waits 55)
  CACHE_SECONDS    how long identical searches are cached (default 1800) - keep this high, Instagram rate limits hard
"""
import os
import re
import glob
import time
import threading
import uuid
from datetime import datetime, timezone
from itertools import islice
from typing import Any
from urllib.parse import unquote

import instaloader
from flask import Flask, jsonify, request

app = Flask(__name__)

SERVICE_TOKEN = os.environ.get("SERVICE_TOKEN", "")
PROFILES = [p.strip().lstrip("@") for p in os.environ.get("IG_PROFILES", "").split(",") if p.strip()]
SEARCH_PAGES = int(os.environ.get("IG_SEARCH_PAGES", "3"))
MAX_TAGS = int(os.environ.get("IG_MAX_TAGS", "3"))
MAX_POSTS = int(os.environ.get("IG_MAX_POSTS", "24"))
TIME_BUDGET = float(os.environ.get("TIME_BUDGET", "40"))
CACHE_SECONDS = int(os.environ.get("CACHE_SECONDS", "1800"))
MAX_RESULTS = 60

_lock = threading.Lock()  # Instaloader's context isn't thread safe and we want to be gentle with Instagram
_cache: dict[str, tuple[float, Any]] = {}
_post_cache: dict[str, tuple[float, Any]] = {}

RateLimited = instaloader.exceptions.TooManyRequestsException
LoginRequired = instaloader.exceptions.LoginRequiredException


class OutOfTime(Exception):
    pass


class FailFastRateController(instaloader.RateController):
    """Instaloader normally sleeps for minutes when rate limited; a web request can't wait that long."""

    def sleep(self, secs: float):
        if secs > 15:
            raise RateLimited(f"rate limited for {int(secs)}s")
        time.sleep(secs)


SESSION_DIR = os.path.dirname(os.environ.get("IG_SESSIONFILE", "")) or "/session"
LOGIN_EXPIRED = "The Instagram login has expired - paste a new sessionid cookie on the site's /instagram/session page"

_accounts: dict[str, instaloader.Instaloader] = {}  # username -> logged-in loader, preferred first
_expired: set[str] = set()
_turn = 0  # round-robin position, so the accounts share the load


def new_loader() -> instaloader.Instaloader:
    return instaloader.Instaloader(
        download_pictures=False, download_videos=False, download_video_thumbnails=False,
        download_geotags=False, download_comments=False, save_metadata=False,
        compress_json=False, quiet=True, max_connection_attempts=1,
        rate_controller=lambda ctx: FailFastRateController(ctx),
    )


def load_accounts():
    for path in sorted(glob.glob(os.path.join(SESSION_DIR, "session-*")), key=os.path.getmtime, reverse=True):
        username = os.path.basename(path)[len("session-"):]
        loader = new_loader()
        try:
            loader.load_session_from_file(username, path)
            _accounts[username] = loader
        except Exception as error:
            print(f"Couldn't load {path}: {error}", flush=True)
    user, password = os.environ.get("IG_USER"), os.environ.get("IG_PASSWORD")
    if not _accounts and user and password:
        loader = new_loader()
        try:
            loader.login(user, password)
            _accounts[user] = loader
        except Exception as error:  # run anonymously rather than crash; search will then fail with a clear error
            print(f"Instagram login failed: {error}", flush=True)


def pick_account() -> bool:
    """Point L at the first account that hasn't been logged out; False (and an anonymous L) if none is left."""
    global L
    for username, loader in _accounts.items():
        if username not in _expired:
            L = loader
            return True
    L = new_loader()
    return False


def logged_out(error: Exception) -> bool:
    text = str(error).lower()
    # login_required: session expired; user_has_logged_out: someone pressed "Log out" in a browser with that account
    return isinstance(error, LoginRequired) or any(m in text for m in ("login_required", "logged_out", "checkpoint"))


def take_turn():
    """Point L at the next working account in rotation (call once per fresh search or post lookup)."""
    global L, _turn
    working = [loader for username, loader in _accounts.items() if username not in _expired]
    if working:
        L = working[_turn % len(working)]
        _turn += 1
    else:
        pick_account()


def retire_current():
    if L.context.username:
        print(f"Instagram logged out @{L.context.username}", flush=True)
        _expired.add(L.context.username)


L = new_loader()
load_accounts()
pick_account()


def tokens(query: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", query.lower()) if len(t) > 1]


def key_words(words: list[str]) -> list[str]:
    """The words a result must contain: model numbers ("840", "g3") if any, otherwise every word."""
    return [w for w in words if any(c.isdigit() for c in w)] or words


def score(caption: str, words: list[str]) -> int:
    text = caption.lower()
    return sum(1 for w in words if w in text)


# --- keyword search ("For you" grid) ---------------------------------------------------------

def best_image(media: dict) -> str | None:
    candidates = (media.get("image_versions2") or {}).get("candidates") or []
    if not candidates:
        return None
    return max(candidates, key=lambda c: c.get("width", 0) * c.get("height", 0)).get("url")


def media_to_item(media: dict, source: str, words: list[str]) -> dict[str, Any] | None:
    code = media.get("code")
    if not code:
        return None
    children = media.get("carousel_media") or []
    images = [url for url in (best_image(child) for child in children if child.get("media_type") != 2) if url] if children else []
    if not images and (url := best_image(media) or (best_image(children[0]) if children else None)):
        images = [url]  # the photo, or a video's cover
    if not images:
        return None
    caption = (media.get("caption") or {}).get("text") or ""
    taken = media.get("taken_at")
    return {
        "id": str(media.get("pk") or ""),
        "shortcode": code,
        "permalink": f"https://www.instagram.com/p/{code}/",
        "caption": caption[:1500],
        "date": datetime.fromtimestamp(taken, timezone.utc).isoformat() if taken else "",
        "owner": (media.get("user") or {}).get("username", ""),
        "source": source,
        "images": images[:20],
        # search results carry only a carousel's first photo; /post returns the rest
        "imageCount": max(media.get("carousel_media_count") or 0, len(images)),
        "isVideo": media.get("media_type") == 2,
        "likes": media.get("like_count") or 0,
        "views": media.get("play_count") or media.get("view_count") or 0,
        "score": score(caption, words),
    }


def find_medias(node: Any) -> list[dict]:
    """Search and hashtag responses nest posts in sections/layouts that Instagram reshuffles; collect every media dict."""
    out: list[dict] = []
    if isinstance(node, dict):
        media = node.get("media")
        if isinstance(media, dict) and media.get("code"):
            out.append(media)
        else:
            for value in node.values():
                out.extend(find_medias(value))
    elif isinstance(node, list):
        for value in node:
            out.extend(find_medias(value))
    return out


def add_medias(node: Any, source: str, words: list[str], found: dict[str, dict], limit: int | None = None) -> int:
    """Add the posts in a response to `found`. A post can appear twice (a featured reel and a grid tile) and
    only one copy carries the caption, so a later copy fills in a missing caption."""
    added = 0
    for media in find_medias(node):
        item = media_to_item(media, source, words)
        if not item:
            continue
        existing = found.get(item["shortcode"])
        if existing:
            if not existing["caption"] and item["caption"]:
                existing.update(caption=item["caption"], score=item["score"])
            continue
        if limit is not None and added >= limit:
            continue
        found[item["shortcode"]] = item
        added += 1
    return added


def keyword_search(query: str, words: list[str], found: dict[str, dict], deadline: float):
    # the mobile app's search; the website's api/v1/fbsearch/web/top_serp/ was removed in 2026
    params: dict[str, Any] = {"query": query, "search_surface": "top_serp_page", "search_session_id": str(uuid.uuid4())}
    for _ in range(SEARCH_PAGES):
        if time.time() > deadline:
            raise OutOfTime()
        data = L.context.get_iphone_json("api/v1/fbsearch/top_serp/", params)
        grid = data.get("media_grid") or {}
        add_medias(grid.get("sections", []), "search", words, found)
        if not grid.get("has_more") or not grid.get("next_max_id") or len(found) >= MAX_RESULTS:
            break
        params.update({key: grid[key] for key in ("next_max_id", "rank_token", "reels_max_id", "reels_page_index") if key in grid})


# --- hashtags and profiles (fallback / extra) --------------------------------------------------

def candidate_tags(words: list[str]) -> list[str]:
    tags = ["".join(words)]
    if len(words) > 2:
        tags.append("".join(words[1:]))  # "hp 840 g3" -> also #840g3
    return tags[:MAX_TAGS]


def post_to_item(post: instaloader.Post, source: str, words: list[str]) -> dict[str, Any]:
    images = [post.url]
    if post.typename == "GraphSidecar":
        try:
            images = [node.display_url for node in post.get_sidecar_nodes() if not node.is_video] or images
        except Exception:
            pass
    caption = post.caption or ""
    try:
        owner = post.owner_username
    except Exception:
        owner = ""
    return {
        "id": str(post.mediaid),
        "shortcode": post.shortcode,
        "permalink": f"https://www.instagram.com/p/{post.shortcode}/",
        "caption": caption[:1500],
        "date": post.date_utc.isoformat(),
        "owner": owner,
        "source": source,
        "images": images[:20],
        "imageCount": len(images[:20]),
        "isVideo": bool(post.is_video),
        "likes": post.likes or 0,
        "views": 0,
        "score": score(caption, words),
    }


def collect(posts, source: str, words: list[str], found: dict[str, dict], deadline: float):
    """Profile posts: keep only those whose caption mentions the product."""
    for post in islice(posts, MAX_POSTS):
        if time.time() > deadline:
            raise OutOfTime()
        if post.shortcode in found or not all(w in (post.caption or "").lower() for w in key_words(words)):
            continue
        found[post.shortcode] = post_to_item(post, source, words)


def hashtag_search(words: list[str], found: dict[str, dict], deadline: float, errors: list[str]) -> list[str]:
    # read the tag page directly: Instaloader 4.15's Hashtag parser no longer matches Instagram's layout
    tags = candidate_tags(words)
    for tag in tags:
        if time.time() > deadline:
            raise OutOfTime()
        try:
            data = L.context.get_iphone_json("api/v1/tags/web_info/", {"tag_name": tag})
            data = data.get("data", data)
            add_medias([data.get("top"), data.get("recent")], f"#{tag}", words, found, MAX_POSTS)
        except instaloader.exceptions.QueryReturnedNotFoundException:
            continue  # nobody uses this tag
        except (RateLimited, LoginRequired):
            raise
        except Exception as error:
            if logged_out(error):
                raise LoginRequired(str(error))
            errors.append(f"#{tag}: {error}")
        if len(found) >= MAX_RESULTS:
            break
    return tags


def authorized() -> bool:
    return bool(SERVICE_TOKEN) and request.headers.get("X-Service-Token") == SERVICE_TOKEN


def account_status() -> dict[str, Any]:
    return {"active": L.context.username, "accounts": [{"username": u, "loggedOut": u in _expired} for u in _accounts]}  # active = used last


@app.get("/health")
def health():
    return jsonify({"ok": True, "loggedIn": bool(L.context.username), "profiles": PROFILES, **account_status()})


@app.get("/session")
def session_status():
    if not authorized():
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify(account_status())


@app.post("/session")
def session_update():
    """Add or refresh an account from a browser's sessionid cookie; it becomes the active one."""
    if not authorized():
        return jsonify({"error": "Unauthorized"}), 401
    sessionid = unquote(str((request.get_json(silent=True) or {}).get("sessionid") or "").strip().strip('"'))
    if not re.fullmatch(r"\d+:[A-Za-z0-9_\-:%.]{8,}", sessionid):
        return jsonify({"error": "That doesn't look like a sessionid cookie (it starts with numbers and a colon)"}), 400

    loader = new_loader()
    jar = loader.context._session.cookies
    jar.set("sessionid", sessionid, domain=".instagram.com")
    jar.set("ds_user_id", sessionid.split(":")[0], domain=".instagram.com")
    username = None
    try:
        me = loader.context.get_iphone_json("api/v1/accounts/current_user/", {"edit": "true"})
        username = (me.get("user") or {}).get("username")
    except Exception as error:
        print(f"current_user check failed, trying test_login: {error}", flush=True)
    if not username:
        try:
            username = loader.test_login()  # the web check; None for a dead cookie
        except Exception as error:
            print(f"test_login failed: {error}", flush=True)
    if not username:
        return jsonify({"error": "Instagram didn't accept that cookie. Log in again in the browser, copy sessionid fresh, and don't log out afterwards"}), 400

    loader.context.username = username
    with _lock:
        loader.save_session_to_file(os.path.join(SESSION_DIR, f"session-{username}"))
        others = {u: l for u, l in _accounts.items() if u != username}
        _accounts.clear()
        _accounts.update({username: loader, **others})  # newest first
        _expired.discard(username)
        pick_account()
    print(f"Instagram session updated for @{username}", flush=True)
    return jsonify({"ok": True, "username": username, **account_status()})


@app.get("/post")
def post_details():
    """Every photo and the full caption of one post (search results carry only the first photo of a carousel)."""
    if not authorized():
        return jsonify({"error": "Unauthorized"}), 401
    media_id = (request.args.get("id") or "").strip()
    if not media_id.isdigit():
        return jsonify({"error": "id is required"}), 400
    cached = _post_cache.get(media_id)
    if cached and time.time() - cached[0] < CACHE_SECONDS:
        return jsonify(cached[1])
    with _lock:
        take_turn()
        while True:
            if not L.context.username:
                return jsonify({"error": LOGIN_EXPIRED, "loginNeeded": True}), 503
            try:
                data = L.context.get_iphone_json(f"api/v1/media/{media_id}/info/", {})
                item = media_to_item((data.get("items") or [{}])[0], "post", [])
                break
            except RateLimited:
                return jsonify({"error": "Instagram rate limit reached, try again in a while"}), 429
            except Exception as error:
                if not logged_out(error):
                    return jsonify({"error": f"Couldn't load the post: {error}"}), 502
                retire_current()
                pick_account()  # try the next account, if there is one
    if not item:
        return jsonify({"error": "The post has no photos"}), 404
    _post_cache[media_id] = (time.time(), item)
    return jsonify(item)


def run_search(query: str, words: list[str]) -> tuple[dict[str, dict], list[str], list[str], bool]:
    """One pass over keyword search, hashtags and profiles; the last value is True if Instagram logged us out."""
    found: dict[str, dict] = {}
    errors: list[str] = []
    tags: list[str] = []
    deadline = time.time() + TIME_BUDGET
    try:
        try:
            keyword_search(query, words, found, deadline)
        except (RateLimited, LoginRequired, OutOfTime):
            raise
        except Exception as error:
            if logged_out(error):
                raise LoginRequired(str(error))
            print(f"Instagram keyword search failed: {error}", flush=True)
            errors.append(f"Keyword search: {error}")
        if len(found) < MAX_RESULTS:
            tags = hashtag_search(words, found, deadline, errors)
        for username in PROFILES:
            try:
                profile = instaloader.Profile.from_username(L.context, username)
                collect(profile.get_posts(), f"@{username}", words, found, deadline)
            except (RateLimited, LoginRequired, OutOfTime):
                raise
            except Exception as error:
                if logged_out(error):
                    raise LoginRequired(str(error))
                errors.append(f"@{username}: {error}")
    except RateLimited:
        errors.append("Instagram rate limit reached - showing what was found so far, try again in a while")
    except LoginRequired:
        return found, errors, tags, True
    except OutOfTime:
        pass  # return what we have; a repeat search is served from the cache
    return found, errors, tags, False


@app.get("/search")
def search():
    if not authorized():
        return jsonify({"error": "Unauthorized"}), 401
    query = " ".join((request.args.get("query") or "").split())
    words = tokens(query)
    if not words:
        return jsonify({"error": "query is required"}), 400
    key = " ".join(words)
    cached = _cache.get(key)
    if cached and time.time() - cached[0] < CACHE_SECONDS:
        return jsonify({**cached[1], "cached": True})

    with _lock:
        take_turn()
        while True:
            if not L.context.username:
                return jsonify({"query": query, "tags": [], "posts": [], "errors": [LOGIN_EXPIRED], "loginNeeded": True})
            found, errors, tags, expired = run_search(query, words)
            if not expired:
                break
            retire_current()
            pick_account()  # the next account starts the search over; with none left the loop reports it

    if found:
        errors = [e for e in errors if not e.startswith("Keyword search:")]  # hashtags covered for it
    # keyword-search order is Instagram's relevance ranking, so keep it first; sort only the extras
    ordered = [p for p in found.values() if p["source"] == "search"]
    ordered += sorted((p for p in found.values() if p["source"] != "search"), key=lambda p: (p["score"], p["date"]), reverse=True)
    payload = {"query": query, "tags": tags, "posts": ordered[:MAX_RESULTS], "errors": errors}
    if ordered or not errors:  # don't cache pure failures
        _cache[key] = (time.time(), payload)
    return jsonify(payload)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
