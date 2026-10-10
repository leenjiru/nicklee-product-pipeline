# phone-specs-site

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_unlKYRTM5XMDtKLZrWIpZMhxhJRM)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.

## Instagram images (laptop search)

The laptop page can show images from Instagram posts. It uses [Instaloader](https://github.com/instaloader/instaloader) in a small separate service (`instagram-service/`), because Instaloader is Python and needs a long-running host (not Vercel).

1. Deploy `instagram-service/` anywhere that runs Docker/Python. Set `SERVICE_TOKEN` (any long random string), `IG_PROFILES` (comma-separated usernames to search) and, recommended, `IG_USER` + `IG_SESSIONFILE` (create the session file with `instaloader --login=YOUR_USER`). See the header of `instagram-service/app.py` for every option.
2. In the Next.js project set `INSTAGRAM_SERVICE_URL` (the service's URL) and `INSTAGRAM_SERVICE_TOKEN` (same as `SERVICE_TOKEN`).

Instagram rate-limits and blocks scraping, so results are cached for 10 minutes and the service scans only recent posts. Use a dedicated Instagram account for the login, not your main one.
