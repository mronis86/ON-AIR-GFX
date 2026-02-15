/**
 * ON-AIR GFX – Google Apps Script: Timed CSV Refresh
 * Fetches live Q&A and Poll CSV from Railway and writes to your sheet.
 * Use this for frequent refresh (e.g. every 1 min) instead of IMPORTDATA (which refreshes ~hourly).
 *
 * SETUP:
 * 1. Open your Google Sheet → Extensions → Apps Script
 * 2. Delete any code in Code.gs and paste this entire file. Save.
 * 3. Edit CONFIG below: paste your Railway URL and Event ID
 * 4. (Optional) Edit sheet names and cell ranges where Q&A and Poll data will be written
 * 5. Run testAuth once. When prompted, authorize (Advanced → Go to … if "unverified")
 * 6. Run refreshAll once to test
 * 7. Triggers: Edit → Current project's triggers → Add trigger:
 *    - Function: refreshAll
 *    - Event: Time-driven
 *    - Interval: Every minute (or every 5 min, etc.)
 */

var CONFIG = {
  RAILWAY_BASE_URL: 'https://your-app.up.railway.app',  // No trailing slash. From Operators → Output → Railway URL
  EVENT_ID: 'YOUR_EVENT_ID_HERE',                        // From event URL, e.g. abc123
  QA_SHEET: 'Live Q&A',                                  // Sheet name for Q&A CSV
  QA_CELL: 'A1',                                         // Top-left cell for Q&A data
  POLL_SHEET: 'Live Poll',                               // Sheet name for Poll CSV
  POLL_CELL: 'A1'                                        // Top-left cell for Poll data
};

function testAuth() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('OK: Script can access the spreadsheet. Now run refreshAll.');
}

function refreshAll() {
  if (!CONFIG.RAILWAY_BASE_URL || !CONFIG.EVENT_ID ||
      CONFIG.RAILWAY_BASE_URL.indexOf('your-app') >= 0 ||
      CONFIG.EVENT_ID.indexOf('YOUR_') >= 0) {
    Logger.log('Edit CONFIG: set RAILWAY_BASE_URL and EVENT_ID.');
    return;
  }
  var base = CONFIG.RAILWAY_BASE_URL.replace(/\/+$/, '');
  refreshQA(base);
  refreshPoll(base);
}

function refreshQA(base) {
  var url = base + '/live-qa-csv?eventId=' + encodeURIComponent(CONFIG.EVENT_ID);
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    Logger.log('Q&A fetch failed: ' + response.getContentText());
    return;
  }
  var csv = response.getContentText();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, CONFIG.QA_SHEET);
  writeCsvToSheet(sheet, csv, CONFIG.QA_CELL);
}

function refreshPoll(base) {
  var url = base + '/live-poll-csv?eventId=' + encodeURIComponent(CONFIG.EVENT_ID);
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    Logger.log('Poll fetch failed: ' + response.getContentText());
    return;
  }
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
  var lines = csv.split(/\r\n|\r|\n/);
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
  var result = [];
  var current = '';
  var inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line.charAt(i);
    if (ch === '"') {
      if (inQuotes && line.charAt(i + 1) === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (inQuotes) {
      current += ch;
    } else if (ch === ',') {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
