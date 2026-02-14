# Railway: Where to set Root Directory (or use the Dockerfile)

You only need **one** of these; using **both** (Root Directory + variable) is safe and can help if one setting is missed.

---

## Option A: Find Root Directory in the UI

1. Go to **https://railway.app** and open your **dashboard**.
2. Click your **project** (the one that has the ON-AIR-GFX repo from GitHub).
3. You’ll see a **canvas** (big area) with one or more **boxes** – each box is a **service** (one deployable app).
4. **Click the service** that’s linked to GitHub (the one that’s building ON-AIR-GFX). That opens the **service view** (you’ll see Deployments, logs, etc.).
5. At the top of the service view you should see **tabs**: e.g. **Deployments** | **Settings** | **Variables** | **Metrics**.
6. Click **Settings**.
7. In Settings, scroll until you see **“Root Directory”** or **“Source”** or **“Build”**.
8. In **Root Directory** (or the root/path field under Build), type: **`live-csv-server`** (no slash before or after).
9. Save. Railway will redeploy using only that folder.

If you don’t see “Root Directory”, look for **“Source”** or **“Monorepo”** or **“Build” → “Root directory”**.

---

## Option B: Root Directory is required

The **Dockerfile** inside `live-csv-server/` expects **Root Directory = live-csv-server**. Do not use RAILWAY_DOCKERFILE_PATH without Root Directory. If you previously set RAILWAY_DOCKERFILE_PATH, remove it and use only Root Directory.

---

## If you only see “the GitHub for this project”

- That usually means you’re on the **project** page (repo connected, list of services).
- **Click the service** (the deployable app box), not the project name or the GitHub link. The service opens in a view where **Settings** and **Variables** tabs appear.
