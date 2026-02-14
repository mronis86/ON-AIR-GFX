# Getting live data into Google Sheets

## Summary

| Option | Cost | Needs script? | Authorization |
|--------|------|----------------|----------------|
| **Blaze + Live CSV URL** | Blaze (free tier often $0) | No | None – paste a formula |
| **Free (Spark) – Apps Script** | Free | Yes | Google may show "unknown error" |
| **Free – no Sheets** | Free | No | Use the app or download CSV |

---

## Option 1: No script – Live CSV URL (Blaze) — recommended if script fails

**Best if:** The Apps Script keeps giving "unknown error" and you’re okay enabling Blaze.

- **Blaze** is pay-as-you-go; the **free tier** (e.g. 2M invocations/month) often means **$0** for typical use.
- You **do not use any Google Apps Script**. No authorization dialogs.
- In the app: event → Google Sheet section → Script dropdown → choose **"No script – Live CSV URL (Blaze)"**.
- Follow the steps: upgrade to Blaze, run `firebase deploy --only functions` once, then paste the **=IMPORTDATA("...")** formula into a cell in your sheet.
- Google Sheets will refresh that CSV periodically (e.g. hourly). No script to run or authorize.

---

## Option 2: Free (Spark) – Google Apps Script

- Stays on the **free Spark** plan.
- Use one of the **script** options (simple or full) from the app. Paste the script in **Extensions → Apps Script**, set CONFIG (API key, Event ID), then run **testAuth** first, then **runLiveSync**.
- **If you get "unknown error"**: Google is blocking or failing authorization. Try a personal Gmail, incognito, or the STANDALONE steps in [Google-Apps-Script-Authorization.md](./Google-Apps-Script-Authorization.md). If it still fails, use Option 1 (Blaze + URL) or Option 3.

---

## Option 3: Free – don’t use Sheets for live display

- **Use the ON-AIR GFX app** for the live view (Operator view or output pages). Data is in Firestore; the app reads it. No Google Sheet needed for the “live” part.
- Or use **Download CSV** in the app when you need a snapshot and paste/import into Sheets manually. Not automatic, but no script and no Blaze.

---

## Do I have to pay for Blaze?

- **No.** Blaze has a **free tier**. You add a payment method, but many projects stay at **$0**.
- You only pay if usage goes over the free quotas (e.g. Cloud Functions invocations, egress). For a single event and occasional refreshes, you typically stay within the free tier.
