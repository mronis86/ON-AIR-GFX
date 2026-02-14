# Google Apps Script – "Unknown error" when authorizing

When you **Run → runLiveSync** (or **testAuth**) and see:

**"An unknown error has occurred, please try again later."**

Google is blocking or failing the first-time authorization. Try the **STANDALONE** method first (fixes it for many users).

---

## Fix: Run the script as STANDALONE (recommended)

Create the script in a **new project at script.google.com**, not from the sheet. That often avoids the "unknown error."

1. **Open** [script.google.com](https://script.google.com) in your browser (use a **personal Gmail** if you can).
2. Click **New project** (blank project, no sheet).
3. **Delete** any code in `Code.gs`, then **paste the full ON-AIR GFX Free plan script** (from the app: Copy script).
4. In **CONFIG** at the top set:
   - **FIREBASE_API_KEY** = same as in your .env (VITE_FIREBASE_API_KEY).
   - **LIVE_STATE_EVENT_ID** = from the app (event → Google Sheet section → Copy Event ID).
   - **PROJECT_ID** = `chamber-on-air-gfx` (unless you use a different Firebase project).
   - **SPREADSHEET_ID** = the **ID of your Google Sheet**. From the sheet URL  
     `https://docs.google.com/spreadsheets/d/XXXXXXXXXX/edit`  
     copy the part **XXXXXXXXXX** (between `/d/` and `/edit`) and paste it in quotes, e.g. `'1abc...xyz'`.
5. **Save** (Ctrl+S).
6. In the function dropdown select **testAuth**, click **Run**. When the browser asks for permission, complete it (use **Advanced** → **Go to … (unsafe)** if you see "This app isn't verified").
7. If testAuth succeeds, select **runLiveSync** and click **Run** again.
8. In the sheet, go to **Extensions → Apps Script** (or keep using script.google.com). **Edit → Current project's triggers** → Add trigger: **runLiveSync**, Time-driven, Every 1 minute.

The script will now run every minute and write live data to the sheet you specified by SPREADSHEET_ID.

---

## Step 1: Run testAuth first (sheet-bound / simple script)

**Both the simple and full scripts include testAuth.** Always run it *before* runLiveSync so Google asks for permission on a simple spreadsheet call, not on the first network call (which often triggers "unknown error").

1. In the Apps Script editor, open the **function** dropdown (next to Run).
2. Select **testAuth** (not runLiveSync).
3. Click **Run** (play button).
4. If a browser tab opens asking for permission, complete it (use **Advanced** → **Go to … (unsafe)** if you see "This app isn't verified").
5. Check **Execution log** (View → Logs or Ctrl+Enter): you should see "OK: Script can access the spreadsheet. Now run runLiveSync."
6. Then select **runLiveSync** and click **Run**.
7. If **testAuth** also shows "unknown error": the problem is account or project. Try Step 2 (personal Gmail) or STANDALONE (script.google.com with the full script).

---

## Step 2: Use a personal Gmail account

- **Work or school** Google accounts often block or restrict Apps Script.
- Open the **same** Google Sheet and script in a **personal Gmail** account (share the sheet to that account or create the sheet there).
- Run **testAuth** again, then **runLiveSync**.

---

## Step 3: New browser or incognito

- Close other Google tabs.
- Open the script in an **incognito/private** window: go to script.google.com, open your project, run **testAuth** then **runLiveSync**.
- Or try a **different browser** (Chrome, Edge, Firefox).

---

## Step 4: New Apps Script project (fixes bad project state)

Sometimes the linked Google Cloud project is in a bad state.

1. In Google Drive (or Sheets), **File → Make a copy** of your sheet (or create a new sheet).
2. In the **new** sheet: **Extensions → Apps Script**.
3. Delete any code in `Code.gs`, then **paste the full ON-AIR GFX script** from the app (Copy script).
4. Fill in **CONFIG** (API key, Event ID, project ID).
5. Save, then run **testAuth**, then **runLiveSync**.

---

## Step 5: Consent screen – use "Advanced"

When a browser tab opens for permission:

- If you see **"This app isn't verified"**: click **Advanced** → **Go to [your project name] (unsafe)**. The script is yours; it’s safe to continue.
- Complete the flow (choose account, allow access). Don’t close the tab before clicking Allow.

---

## Step 6: CONFIG and run method

- In CONFIG, replace **PASTE_YOUR_FIREBASE_WEB_API_KEY_HERE** and **PASTE_YOUR_EVENT_ID_HERE** with your real values (Event ID from the app’s "Copy Event ID" button).
- Run **runLiveSync** from the **Run** menu (play button), not from "Test deployments" or doGet.

---

## Step 7: Retry later

- Google sometimes returns "unknown error" temporarily. Wait 10–30 minutes and try **testAuth** then **runLiveSync** again.

---

After authorization succeeds once, the trigger (e.g. every 1 minute) will run the script without asking again.
