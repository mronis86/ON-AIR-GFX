/**
 * ON-AIR GFX – Google Apps Script (FREE PLAN)
 * Reads live data from Firestore and writes to your sheet.
 *
 * SETUP:
 * 1. Paste this entire file into Apps Script (Extensions → Apps Script). Save.
 * 2. Replace the two values in CONFIG below (see instructions next to each line).
 * 3. Run → testAuth once. When the browser asks for permission, complete it (Advanced → Go to … (unsafe) if you see "This app isn't verified").
 * 4. Run → runLiveSync once. Then: Edit → Current project's triggers → Add: runLiveSync, Time-driven, Every 1 minute.
 */

/* REPLACE THE TWO VALUES BELOW - do not use Script Properties, only edit here */
var CONFIG = {
  FIREBASE_API_KEY: 'PASTE_YOUR_FIREBASE_WEB_API_KEY_HERE',
  LIVE_STATE_EVENT_ID: 'PASTE_YOUR_EVENT_ID_HERE',
  PROJECT_ID: 'chamber-on-air-gfx'
};
/* END CONFIG - FIREBASE_API_KEY = same as .env VITE_FIREBASE_API_KEY. LIVE_STATE_EVENT_ID = from event URL after the word events */

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
    Logger.log('Edit the CONFIG at the top of this script: paste your FIREBASE_API_KEY and LIVE_STATE_EVENT_ID.');
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
    if (q && q.answer) text += '\n\n' + q.answer;
    if (q && q.submitterName) text += '\n— ' + q.submitterName;
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
  if (v.mapValue && v.mapValue.fields) {
    var obj = {};
    for (var k in v.mapValue.fields) obj[k] = parseFirestoreValue(v.mapValue.fields[k]);
    return obj;
  }
  if (v.arrayValue && v.arrayValue.values) {
    return v.arrayValue.values.map(parseFirestoreValue);
  }
  return null;
}
