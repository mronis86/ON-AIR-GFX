/**
 * MINIMAL Google Apps Script – for testing ON-AIR GFX sheet write via Railway.
 *
 * 1. Create a NEW Google Sheet (or use any sheet).
 * 2. Extensions → Apps Script → delete existing code, paste this entire file.
 * 3. Save. Deploy → New deployment → Web app.
 * 4. Execute as: Me. Who has access: Anyone. Deploy.
 * 5. Copy the Web App URL (must end with /exec). Paste into ON-AIR GFX "Web App URL".
 * 6. In ON-AIR GFX, set Poll backup sheet to e.g. Sheet2. Click Test write.
 *
 * This script only handles the same payload the app sends (poll_backup).
 * If Test write succeeds, you’ll see a row in the sheet and success in the app.
 */

function doGet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    message: 'Minimal test Web App is running. Use POST to write (e.g. Test write from ON-AIR GFX).',
    spreadsheet: ss.getName(),
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Missing POST body' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Only handle poll_backup (same shape as ON-AIR GFX Test write)
    if (data.type === 'poll_backup' && data.sheetName && data.data) {
      var sheet = ss.getSheetByName(data.sheetName);
      if (!sheet) sheet = ss.insertSheet(data.sheetName);
      var p = data.data;
      if (sheet.getLastRow() === 0) {
        var header = ['Timestamp', 'Poll ID', 'Poll Title'];
        if (p.options && p.options.length) {
          for (var i = 0; i < p.options.length; i++) {
            header.push('Option ' + (i + 1));
            header.push('Votes ' + (i + 1));
          }
        }
        sheet.getRange(1, 1, 1, header.length).setValues([header]);
        sheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
      }
      var nextRow = sheet.getLastRow() + 1;
      var row = [p.timestamp || new Date().toISOString(), p.id || '', (p.title || '').toString()];
      if (p.options && p.options.length) {
        for (var j = 0; j < p.options.length; j++) {
          row.push((p.options[j].text || '').toString());
          row.push(p.options[j].votes != null ? p.options[j].votes : '');
        }
      }
      sheet.getRange(nextRow, 1, nextRow, row.length).setValues([row]);
      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        sheetName: data.sheetName,
        row: nextRow,
        message: 'Appended to ' + data.sheetName + ' row ' + nextRow,
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Expected type poll_backup with sheetName and data' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
