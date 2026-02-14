# Railway deploy – step by step

Deploy the **live CSV server** so Google Sheets can use **=IMPORTDATA(...)** with no Apps Script and no Firebase Blaze. The server lives in the `live-csv-server` folder of this repo.

---

## 1. Push the latest code to GitHub (if you just added live-csv-server)

From your project folder:

```bash
git add live-csv-server
git commit -m "Add live-csv-server for Railway"
git push
```

---

## 2. Open Railway and start a new project

1. Go to **https://railway.app** and sign in (e.g. with GitHub).
2. Click **New Project**.

---

## 3. Deploy from GitHub

1. Choose **Deploy from GitHub repo**.
2. If asked, authorize Railway to access your GitHub account (or your org).
3. Select the repo: **mronis-chamber/ON-AIR-GFX** (or the repo where you pushed the code).
4. Click **Deploy** (or **Add service** / **Deploy now**). Railway will clone the repo and try to build.

---

## 4. Set the root directory

The repo has both the main app and the `live-csv-server` folder. Railway must build only the server.

1. In your Railway project, click the **service** that was created (the one linked to ON-AIR-GFX).
2. Open **Settings** (or the **Settings** tab).
3. Find **Root Directory** (or **Build** / **Source**).
4. Set it to: **`live-csv-server`** (no leading slash).
5. Save. Railway will redeploy using only that folder.

---

## 5. Add environment variables

1. In the same service, open **Variables** (or **Env** / **Environment**).
2. Click **Add variable** or **New variable**.
3. Add these two:

   | Variable name              | Value                                                                 |
   |----------------------------|-----------------------------------------------------------------------|
   | `FIREBASE_PROJECT_ID`      | Your Firebase project ID (e.g. `chamber-on-air-gfx`)                 |
   | `FIREBASE_SERVICE_ACCOUNT` | Full JSON of your Firebase service account key (see Firebase Console → Project settings → Service accounts → Generate new private key). Paste the entire JSON as one line. |

4. Save. Railway will redeploy so the server sees the new env vars.

---

## 6. Get your Railway URL

1. In the service, open **Settings** or **Deployments**.
2. Find **Domains** (or **Generate domain**). Railway may already have given the service a domain.
3. If there is no domain, click **Generate domain** (or **Add domain**). You’ll get a URL like:
   - `https://on-air-gfx-live-csv-production-xxxx.up.railway.app`
   or
   - `https://your-service-name.railway.app`
4. Copy the full URL (no path), e.g. **`https://something.up.railway.app`**. That’s your **Railway app URL**.

---

## 7. Test the CSV endpoints

In a browser or Postman, open:

**Q&A CSV:**
```text
https://YOUR_RAILWAY_URL/live-qa-csv?eventId=YOUR_EVENT_ID
```

**Poll CSV:**
```text
https://YOUR_RAILWAY_URL/live-poll-csv?eventId=YOUR_EVENT_ID
```

Replace:

- `YOUR_RAILWAY_URL` with the URL from step 6 (no trailing slash).
- `YOUR_EVENT_ID` with a real event ID from your ON-AIR GFX app.

For Q&A: enable a session via the **CSV** button on the Operators page. For Poll: enable a poll via the **CSV** button on the Operators page. You should see a small CSV. If you get an error, check that the env vars are set and that the event ID exists in Firestore.

---

## 8. Use the URLs in Google Sheets

1. In **Google Sheets**, open (or create) the sheet where you want live data.
2. **Q&A** (ACTIVE, Cue, Next): In a cell, enter:
   ```text
   =IMPORTDATA("https://YOUR_RAILWAY_URL/live-qa-csv?eventId=YOUR_EVENT_ID")
   ```
   Enable via **CSV** button on a Q&A session in Operators.
3. **Poll** (title, options, votes): In a cell, enter:
   ```text
   =IMPORTDATA("https://YOUR_RAILWAY_URL/live-poll-csv?eventId=YOUR_EVENT_ID")
   ```
   Enable via **CSV** button on a poll in Operators.
4. Replace `YOUR_RAILWAY_URL` and `YOUR_EVENT_ID` with your values. Press Enter. Sheets will fetch the CSV and refresh it periodically (e.g. every hour). No script, no authorization.

---

## 9. (Optional) Save the Railway URL in the ON-AIR GFX app

If the app has a “Railway URL” or “Live CSV server URL” field in the event’s Google Sheet section, paste your Railway URL there so you can copy the full **=IMPORTDATA(...)** formula from the app next time.

---

## Summary checklist

- [ ] Code pushed to GitHub (including `live-csv-server`).
- [ ] Railway: New project → Deploy from GitHub → select ON-AIR-GFX.
- [ ] Root directory set to **`live-csv-server`**.
- [ ] Variables: **FIREBASE_PROJECT_ID**, **FIREBASE_SERVICE_ACCOUNT**.
- [ ] Domain generated and URL copied.
- [ ] Test: open `https://YOUR_RAILWAY_URL/live-qa-csv?eventId=EVENT_ID` in browser.
- [ ] In Sheets: `=IMPORTDATA("https://YOUR_RAILWAY_URL/live-qa-csv?eventId=EVENT_ID")`.

---

## Troubleshooting

- **Build fails:** Ensure Root Directory is exactly `live-csv-server` and that the folder has `package.json` and `server.js`.
- **500 or “Set FIREBASE_API_KEY”:** Check FIREBASE_PROJECT_ID and FIREBASE_SERVICE_ACCOUNT in Railway → Variables.
- **Empty or wrong CSV:** Check that the event ID is correct and that the Operators app has written live state to Firestore for that event.
- **Sheets doesn’t refresh:** IMPORTDATA refreshes on a schedule (e.g. hourly); you can’t force a refresh from the formula. For more frequent updates, use a trigger or the Apps Script approach.
