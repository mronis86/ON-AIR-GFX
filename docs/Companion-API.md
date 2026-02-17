# Companion API (Bitfocus Companion) via Railway

ON-AIR-GFX is controlled from [Bitfocus Companion](https://bitfocus.io/companion) the same way as the Run of Show module: **Railway URL + Event ID** only. No API key.

## 1. Railway URL

Use your Railway app’s public URL plus the path `/companion-api` (no trailing slash). Examples:

- `https://on-air-gfx-live-csv-production.up.railway.app/companion-api`
- `https://your-custom-domain.com/companion-api` (if you use a custom domain on Railway)

## 2. Companion module config

In the ON-AIR-GFX Companion module:

1. **Railway API URL** – The base URL from step 1.
2. **Event ID** – The event ID from the ON-AIR-GFX web app (Event detail or Operators page).

That’s it. No API key or extra variables.

## Endpoints (for reference)

Base path: `/companion-api`. No authentication headers required.

| Method | Path | Description |
|--------|------|-------------|
| GET | /companion-api/events | List events (id, name, date) |
| GET | /companion-api/events/:eventId/polls | List polls (each has isCsvSource) |
| GET | /companion-api/events/:eventId/qa | List Q&A sessions and questions |
| POST | /companion-api/events/:eventId/poll/csv-source | Body `{ "pollId": "id" \| null }` – which poll feeds CSV only (does not change poll active) |
| POST | /companion-api/events/:eventId/poll/:pollId/active | Body `{ "active": true \| false }` – turn poll on/off (does not set CSV source) |
| POST | /companion-api/events/:eventId/poll/:pollId/public | Body `{ "public": true \| false }` |
| POST | /companion-api/events/:eventId/qa/:qaId/public | Body `{ "public": true \| false }` |
| POST | /companion-api/events/:eventId/qa/csv-source | Body `{ "sessionId": "id" \| null }` – set Q&A session as live CSV source |
| POST | /companion-api/events/:eventId/qa/session/:sessionId/play-next | Play next question in session |
| POST | /companion-api/events/:eventId/qa/question/:questionId/play | Play question |
| POST | /companion-api/events/:eventId/qa/question/:questionId/cue | Cue question |
| POST | /companion-api/events/:eventId/qa/stop | Stop current Q&A question |

## Troubleshooting: 404 or "Cannot POST" on Companion API

If the Companion module logs **"API request failed: HTTP 404"** or **"Cannot POST /companion-api/events/.../qa/csv-source"** (or similar path), the live app on Railway is an **older deployment** that doesn’t include all Companion API routes (e.g. `/qa/csv-source`, `/qa/session/:id/play-next`, `/qa/stop`).

**Fix:** Redeploy the `live-csv-server` from this repo to Railway so the running service has the latest `server.js` (with all `/companion-api` routes).

1. In Railway: open the service that hosts ON-AIR-GFX (e.g. **on-air-gfx-production**).
2. Trigger a new deploy from the same repo/branch that contains the Companion API code (e.g. **Redeploy** from the latest commit, or push a new commit and let Railway auto-deploy).
3. Ensure **Root Directory** is set to `live-csv-server` (so `server.js` with companion-api is the one that runs).
4. After deploy, open `https://your-railway-url.up.railway.app/` in a browser. The page should mention **"Companion API base URL: .../companion-api"**. Then try the Companion module again.
