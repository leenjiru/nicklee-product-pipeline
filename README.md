# phone-specs-site

Product research tool for [nicklee.co.ke](https://nicklee.co.ke), live at [nickleecoke.vercel.app](https://nickleecoke.vercel.app).
It finds phone and laptop specs, product images and descriptions, and compares phones, so products can be listed
on the shop quickly.

- **Phone search and comparison** (`/`, `/compare`): specs from GSMArena and other sites, scored across performance,
  camera, battery, display, storage and extras (`lib/phone-scoring.ts`).
- **Net images and laptops** (`/images`, `/laptops`): product images, details and a copyable description.
- **Instagram images** (`/instagram`): image search backed by `instagram-service/` (see below).
- **Background removal** (`bg-service/`): turns a product photo into a white square with the product centred.

Built with Next.js, TypeScript, Tailwind CSS and shadcn/ui; the two services are Python (Flask) in Docker.

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). A push to `main` deploys to Vercel.

## Instagram images (Instagram page)

The /instagram page searches Instagram (keyword search plus matching hashtags) and shows the posts' images. It uses [Instaloader](https://github.com/instaloader/instaloader) in a small separate service (`instagram-service/`), because Instaloader is Python and needs a long-running host (not Vercel).

1. Deploy `instagram-service/` anywhere that runs Docker/Python. Set `SERVICE_TOKEN` (any long random string), `IG_USER` + `IG_SESSIONFILE` (required, Instagram search needs a login; create the session file with `instaloader --login=YOUR_USER`). See the header of `instagram-service/app.py` for every option.
2. In the Next.js project set `INSTAGRAM_SERVICE_URL` (the service's URL) and `INSTAGRAM_SERVICE_TOKEN` (same as `SERVICE_TOKEN`).

Instagram rate-limits and blocks scraping, so results are cached for 30 minutes and each search reads only a few pages. Use a dedicated Instagram account for the login, not your main one.
