/**
 * Full Google Apps Script for ON-AIR GFX. Shown in the app so end users can copy it
 * without opening the repo. Keep in sync with docs/GoogleSheet-WebApp.gs.
 */
export const GOOGLE_SHEET_SCRIPT = `/**
 * ON-AIR GFX – Google Apps Script Web App
 * 
 * 1. Open your Google Sheet
 * 2. Extensions → Apps Script
 * 3. Delete any code in Code.gs and paste this entire file
 * 4. Save (Ctrl+S), then Deploy → New deployment
 * 5. Type: Web app. Execute as: Me. Who has access: Anyone
 * 6. Deploy and copy the Web App URL (URL should end with the path exec)
 * 7. Paste that URL into your event's "Web App URL (for writing)" in ON-AIR GFX
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    if (data.type === 'initialize' && data.sheetNames && Array.isArray(data.sheetNames)) {
      data.sheetNames.forEach(function(name) {
        if (name && !ss.getSheetByName(name)) {
          ss.insertSheet(name);
        }
      });
      return jsonResponse(200, { ok: true, message: 'Sheets initialized' });
    }
    
    if (data.type === 'poll' && data.subSheet && data.poll) {
      var sheet = getOrCreateSheet(ss, data.subSheet);
      sheet.clear();
      var poll = data.poll;
      sheet.getRange(1, 1).setValue('Poll: ' + (poll.title || ''));
      sheet.getRange(2, 1).setValue('ID: ' + (poll.id || ''));
      var row = 4;
      if (poll.options && poll.options.length) {
        sheet.getRange(row, 1).setValue('Option');
        sheet.getRange(row, 2).setValue('Votes');
        row++;
        poll.options.forEach(function(opt) {
          sheet.getRange(row, 1).setValue(opt.text || '');
          sheet.getRange(row, 2).setValue(opt.votes != null ? opt.votes : '');
          row++;
        });
      }
      return jsonResponse(200, { ok: true });
    }
    
    if (data.type === 'qa_active' && data.sheetName && data.cell && data.data) {
      var qaSheet = getOrCreateSheet(ss, data.sheetName);
      var d = data.data;
      var text = (d.question || '').trim();
      if ((d.answer || '').trim()) text += '\\n\\n' + (d.answer || '').trim();
      if ((d.submitterName || '').trim()) text += '\\n— ' + (d.submitterName || '').trim();
      qaSheet.getRange(data.cell).setValue(text);
      return jsonResponse(200, { ok: true });
    }
    
    return jsonResponse(400, { ok: false, error: 'Unknown type or missing fields' });
  } catch (err) {
    return jsonResponse(500, { ok: false, error: err.toString() });
  }
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function jsonResponse(statusCode, body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

/** Free-plan script: reads from Firestore and writes to sheet. Includes doGet for CSV link. */
export const GOOGLE_SHEET_SCRIPT_FIRESTORE = `/**
 * ON-AIR GFX – Google Apps Script (FREE PLAN)
 * Reads live data from Firestore and writes to your sheet.
 *
 * SETUP:
 * 1. Paste this entire file into Apps Script (Extensions → Apps Script). Save.
 * 2. Copy your values into the CONFIG section below (see instructions there).
 * 3. Run → runLiveSync once. Authorize when asked.
 * 4. Edit → Current project's triggers → Add: runLiveSync, Time-driven, Every 1 minute.
 * 5. Deploy as Web app (Deploy → Deploy as web app). Copy the URL. Paste it in the event's "Web App URL" in the app.
 *
 * IF AUTHORIZATION FAILS ("Unknown error" or "This app isn't verified"):
 * - On the consent screen click Advanced, then "Go to [your project name] (unsafe)" to continue. The script is yours; Google labels unverified apps this way.
 * - If blocked by work/school, try with a personal Gmail account.
 * - Try again in an incognito or private browser window.
 * - Run runLiveSync from the Run menu (not Test deployments). Authorize when the browser opens.
 * - If it still fails: Run testAuth first. If testAuth also gives "unknown error", use STANDALONE (see below).
 *
 * STANDALONE (fixes "unknown error" for many users): Do NOT create the script from the sheet. Instead: (1) Go to script.google.com and click New project. (2) Paste this entire script. (3) In CONFIG set SPREADSHEET_ID = the ID from your sheet URL (between /d/ and /edit). (4) Run testAuth, then runLiveSync. Leave FIREBASE_API_KEY, LIVE_STATE_EVENT_ID, PROJECT_ID as usual.
 */

// Run this first to test authorization. If this works, run runLiveSync next.
function testAuth() {
  var ss = getSpreadsheet();
  Logger.log('OK: Script can access the spreadsheet. Now run runLiveSync.');
}

function getSpreadsheet() {
  if (CONFIG.SPREADSHEET_ID) return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

// ============================================================
// COPY YOUR VALUES HERE (replace the placeholder text)
// ============================================================
// API KEY:  Same as .env VITE_FIREBASE_API_KEY.
// EVENT ID: From the app: event → Google Sheet section → Copy Event ID. Paste as LIVE_STATE_EVENT_ID.
// PROJECT:  Usually "chamber-on-air-gfx".
// SPREADSHEET_ID: Only for STANDALONE (script from script.google.com). From your sheet URL: the part between /d/ and /edit. Leave empty if the script lives in the sheet (Extensions → Apps Script).
// ============================================================

var CONFIG = {
  FIREBASE_API_KEY: 'PASTE_YOUR_FIREBASE_WEB_API_KEY_HERE',
  LIVE_STATE_EVENT_ID: 'PASTE_YOUR_EVENT_ID_HERE',
  PROJECT_ID: 'chamber-on-air-gfx',
  SPREADSHEET_ID: ''
};

function runLiveSync() {
  var apiKey = CONFIG.FIREBASE_API_KEY;
  var eventId = CONFIG.LIVE_STATE_EVENT_ID;
  var projectId = CONFIG.PROJECT_ID;

  if (!apiKey || !eventId || apiKey.indexOf('PASTE_') === 0 || eventId.indexOf('PASTE_') === 0) {
    Logger.log('Edit the CONFIG at the top of this script: paste your FIREBASE_API_KEY and LIVE_STATE_EVENT_ID.');
    return;
  }

  var url = 'https://firestore.googleapis.com/v1/projects/' +
    projectId +
    '/databases/(default)/documents/liveState/' +
    encodeURIComponent(eventId) +
    '?key=' +
    encodeURIComponent(apiKey);

  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

  if (response.getResponseCode() !== 200) {
    Logger.log('Firestore fetch failed: ' + response.getContentText());
    return;
  }

  var doc = JSON.parse(response.getContentText());
  if (!doc.fields) return;

  var data = parseFirestoreFields(doc.fields);
  var ss = getSpreadsheet();

  if (data.pollSheetName && data.activePoll) {
    var pollSheet = getOrCreateSheet(ss, data.pollSheetName);
    pollSheet.clear();

    pollSheet.getRange(1, 1).setValue('Poll: ' + (data.activePoll.title || ''));
    pollSheet.getRange(2, 1).setValue('ID: ' + (data.activePoll.id || ''));

    var row = 4;

    if (data.activePoll.options && data.activePoll.options.length) {
      pollSheet.getRange(row, 1).setValue('Option');
      pollSheet.getRange(row, 2).setValue('Votes');
      row++;

      data.activePoll.options.forEach(function(opt) {
        pollSheet.getRange(row, 1).setValue(opt.text || '');
        pollSheet.getRange(row, 2).setValue(opt.votes != null ? opt.votes : '');
        row++;
      });
    }
  }

  if (data.qaSheetName && data.qaCell && data.activeQA !== undefined) {
    var qaSheet = getOrCreateSheet(ss, data.qaSheetName);
    var q = data.activeQA;
    var text = (q && q.question) ? q.question : '';

    if (q && q.answer) text += '\\n\\n' + q.answer;
    if (q && q.submitterName) text += '\\n— ' + q.submitterName;

    qaSheet.getRange(data.qaCell).setValue(text);
  }
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function parseFirestoreFields(fields) {
  var out = {};
  for (var key in fields) {
    out[key] = parseFirestoreValue(fields[key]);
  }
  return out;
}

function parseFirestoreValue(v) {
  if (!v) return null;
  if (v.nullValue !== undefined) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;

  if (v.mapValue && v.mapValue.fields) {
    var obj = {};
    for (var k in v.mapValue.fields) {
      obj[k] = parseFirestoreValue(v.mapValue.fields[k]);
    }
    return obj;
  }

  if (v.arrayValue && v.arrayValue.values) {
    return v.arrayValue.values.map(parseFirestoreValue);
  }

  return null;
}

// When vMix (or any app) GETs your Web App URL with ?eventId=XXX,
// return live Q&A as CSV (same as Download CSV).
function doGet(e) {
  var eventId = (e && e.parameter && e.parameter.eventId)
    ? e.parameter.eventId.toString().trim()
    : '';

  if (!eventId) {
    return ContentService
      .createTextOutput('Missing eventId. Use: YourWebAppUrl?eventId=YOUR_EVENT_ID')
      .setMimeType(ContentService.MimeType.TEXT);
  }

  var apiKey = CONFIG.FIREBASE_API_KEY;
  var projectId = CONFIG.PROJECT_ID;

  if (!apiKey || !projectId || apiKey.indexOf('PASTE_') === 0) {
    return ContentService
      .createTextOutput('Edit CONFIG: set FIREBASE_API_KEY and PROJECT_ID')
      .setMimeType(ContentService.MimeType.TEXT);
  }

  var url = 'https://firestore.googleapis.com/v1/projects/' +
    projectId +
    '/databases/(default)/documents/liveState/' +
    encodeURIComponent(eventId) +
    '?key=' +
    encodeURIComponent(apiKey);

  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

  if (response.getResponseCode() !== 200) {
    return ContentService
      .createTextOutput('Error fetching data: ' + response.getContentText())
      .setMimeType(ContentService.MimeType.TEXT);
  }

  var doc = JSON.parse(response.getContentText());
  var data = (doc.fields) ? parseFirestoreFields(doc.fields) : {};
  var q = data.activeQA || null;
  var eventName = data.eventName || '';
  var updatedAt = data.updatedAt ? String(data.updatedAt) : '';

  function esc(s) {
    if (s == null) s = '';
    var t = String(s).replace(/"/g, '""');
    return /[,"\\r\\n]/.test(t) ? '"' + t + '"' : t;
  }

  var csv =
    'Question,Answer,Submitter,Event,Updated\\n' +
    [
      esc(q && q.question),
      esc(q && q.answer),
      esc(q && q.submitterName),
      esc(eventName),
      esc(updatedAt)
    ].join(',');

  return ContentService
    .createTextOutput(csv)
    .setMimeType(ContentService.MimeType.CSV);
}
`;

/** Simpler Free plan script (sheet-bound only): same as docs/GoogleSheet-FirestorePull.gs. No doGet, no testAuth, no SPREADSHEET_ID. Use when the script is created from the sheet (Extensions → Apps Script). */
export const GOOGLE_SHEET_SCRIPT_FIRESTORE_SIMPLE = `/**
 * ON-AIR GFX – Google Apps Script (FREE PLAN) – Sheet-bound
 * Reads live data from Firestore and writes to your sheet.
 *
 * SETUP:
 * 1. In your Google Sheet: Extensions → Apps Script. Paste this entire file. Save.
 * 2. In CONFIG below set FIREBASE_API_KEY (same as .env) and LIVE_STATE_EVENT_ID (from app: Copy Event ID).
 * 3. Run → testAuth once. When the browser asks for permission, complete it (Advanced → Go to … (unsafe) if needed).
 * 4. Run → runLiveSync once. Then add trigger: Edit → Current project's triggers → runLiveSync, Time-driven, Every 1 minute.
 */

var CONFIG = {
  FIREBASE_API_KEY: 'PASTE_YOUR_FIREBASE_WEB_API_KEY_HERE',
  LIVE_STATE_EVENT_ID: 'PASTE_YOUR_EVENT_ID_HERE',
  PROJECT_ID: 'chamber-on-air-gfx'
};

/** Run this first to trigger authorization (spreadsheet only). Then run runLiveSync. */
function testAuth() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('OK: Script can access the spreadsheet. Now run runLiveSync.');
}

function runLiveSync() {
  var apiKey = CONFIG.FIREBASE_API_KEY;
  var eventId = CONFIG.LIVE_STATE_EVENT_ID;
  var projectId = CONFIG.PROJECT_ID;
  if (!apiKey || !eventId || apiKey.indexOf('PASTE_') === 0 || eventId.indexOf('PASTE_') === 0) {
    Logger.log('Edit the CONFIG at the top: paste FIREBASE_API_KEY and LIVE_STATE_EVENT_ID.');
    return;
  }
  var pathPrefix = 'https://firestore.googleapis.com/v1/projects/';
  var pathSuffix = '/databases/(default)/documents/liveState/';
  var url = pathPrefix + projectId + pathSuffix + encodeURIComponent(eventId) + '?key=' + encodeURIComponent(apiKey);
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    Logger.log('Firestore fetch failed: ' + response.getContentText());
    return;
  }
  var doc = JSON.parse(response.getContentText());
  if (!doc.fields) return;
  var data = parseFirestoreFields(doc.fields);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (data.pollSheetName && data.activePoll) {
    var pollSheet = getOrCreateSheet(ss, data.pollSheetName);
    pollSheet.clear();
    pollSheet.getRange(1, 1).setValue('Poll: ' + (data.activePoll.title || ''));
    pollSheet.getRange(2, 1).setValue('ID: ' + (data.activePoll.id || ''));
    var row = 4;
    if (data.activePoll.options && data.activePoll.options.length) {
      pollSheet.getRange(row, 1).setValue('Option');
      pollSheet.getRange(row, 2).setValue('Votes');
      row++;
      data.activePoll.options.forEach(function(opt) {
        pollSheet.getRange(row, 1).setValue(opt.text || '');
        pollSheet.getRange(row, 2).setValue(opt.votes != null ? opt.votes : '');
        row++;
      });
    }
  }
  if (data.qaSheetName && data.qaCell && data.activeQA !== undefined) {
    var qaSheet = getOrCreateSheet(ss, data.qaSheetName);
    var q = data.activeQA;
    var text = (q && q.question) ? q.question : '';
    if (q && q.answer) text += '\\n\\n' + q.answer;
    if (q && q.submitterName) text += '\\n— ' + q.submitterName;
    qaSheet.getRange(data.qaCell).setValue(text);
  }
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function parseFirestoreFields(fields) {
  var out = {};
  for (var key in fields) {
    out[key] = parseFirestoreValue(fields[key]);
  }
  return out;
}

function parseFirestoreValue(v) {
  if (!v) return null;
  if (v.nullValue !== undefined) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.mapValue && v.mapValue.fields) {
    var obj = {};
    for (var k in v.mapValue.fields) {
      obj[k] = parseFirestoreValue(v.mapValue.fields[k]);
    }
    return obj;
  }
  if (v.arrayValue && v.arrayValue.values) {
    return v.arrayValue.values.map(parseFirestoreValue);
  }
  return null;
}
`;

/** Google Apps Script for timed CSV refresh - fetches from Railway every minute. */
export const getTimedRefreshScript = (railwayBaseUrl: string, eventId: string) => `/**
 * ON-AIR GFX – Google Apps Script: Timed CSV Refresh
 * Fetches live Q&A and Poll CSV from Railway and writes to your sheet.
 * Use this for frequent refresh (e.g. every 1 min) instead of IMPORTDATA (which refreshes ~hourly).
 *
 * SETUP:
 * 1. Open your Google Sheet → Extensions → Apps Script
 * 2. Delete any code in Code.gs and paste this entire file. Save.
 * 3. Edit CONFIG below if needed (Railway URL and Event ID are pre-filled)
 * 4. Run testAuth once. When prompted, authorize (Advanced → Go to … if "unverified")
 * 5. Run refreshAll once to test
 * 6. Triggers: Edit → Current project's triggers → Add trigger:
 *    Function: refreshAll | Event: Time-driven | Interval: Every minute
 */

var CONFIG = {
  RAILWAY_BASE_URL: '${railwayBaseUrl.replace(/'/g, "\\'")}',
  EVENT_ID: '${eventId.replace(/'/g, "\\'")}',
  QA_SHEET: 'Live Q&A',
  QA_CELL: 'A1',
  POLL_SHEET: 'Live Poll',
  POLL_CELL: 'A1'
};

function testAuth() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('OK: Script can access the spreadsheet. Now run refreshAll.');
}

function refreshAll() {
  if (!CONFIG.RAILWAY_BASE_URL || !CONFIG.EVENT_ID) {
    Logger.log('Edit CONFIG: set RAILWAY_BASE_URL and EVENT_ID.');
    return;
  }
  var base = CONFIG.RAILWAY_BASE_URL.replace(/\\/+$/, '');
  refreshQA(base);
  refreshPoll(base);
}

function refreshQA(base) {
  var url = base + '/live-qa-csv?eventId=' + encodeURIComponent(CONFIG.EVENT_ID);
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) return;
  var csv = response.getContentText();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, CONFIG.QA_SHEET);
  writeCsvToSheet(sheet, csv, CONFIG.QA_CELL);
}

function refreshPoll(base) {
  var url = base + '/live-poll-csv?eventId=' + encodeURIComponent(CONFIG.EVENT_ID);
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) return;
  var csv = response.getContentText();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, CONFIG.POLL_SHEET);
  writeCsvToSheet(sheet, csv, CONFIG.POLL_CELL);
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function writeCsvToSheet(sheet, csv, topCell) {
  var lines = csv.split(/\\r\\n|\\r|\\n/);
  var rows = [];
  for (var i = 0; i < lines.length; i++) {
    var row = parseCsvLine(lines[i]);
    if (row && row.length > 0) rows.push(row);
  }
  if (rows.length === 0) return;
  var range = sheet.getRange(topCell);
  var numRows = rows.length;
  var numCols = Math.max.apply(null, rows.map(function(r) { return r.length; }));
  var output = [];
  for (var r = 0; r < numRows; r++) {
    var outRow = [];
    for (var c = 0; c < numCols; c++) {
      outRow.push(rows[r][c] !== undefined ? rows[r][c] : '');
    }
    output.push(outRow);
  }
  range.offset(0, 0, numRows, numCols).setValues(output);
}

function parseCsvLine(line) {
  var result = []; var current = ''; var inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line.charAt(i);
    if (ch === '"') {
      if (inQuotes && line.charAt(i + 1) === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (inQuotes) current += ch;
    else if (ch === ',') { result.push(current); current = ''; }
    else current += ch;
  }
  result.push(current);
  return result;
}
`;
