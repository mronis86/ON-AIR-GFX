/**
 * ON-AIR GFX – Google Apps Script Web App
 * 
 * The script writes ONLY to the spreadsheet it is attached to. Add it to the SAME sheet you linked in ON-AIR GFX.
 * 1. Open the TARGET Google Sheet (the one you linked as "Google Sheet URL")
 * 2. In that sheet: Extensions → Apps Script
 * 3. Delete any code in Code.gs and paste this entire file
 * 4. Save (Ctrl+S), then Deploy → New deployment
 * 5. Type: Web app. Execute as: Me. Who has access: Anyone
 * 6. Deploy and copy the Web App URL (must end with /exec). After script changes: Manage deployments -> Edit -> New version -> Deploy.
 * 7. Paste that URL into your event’s "Web App URL (for writing)" in ON-AIR GFX
 */

/**
 * Called when someone opens the Web App URL in a browser (GET).
 * Confirms the app is deployed and shows which spreadsheet receives writes.
 */
function doGet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var name = ss.getName();
    var url = ss.getUrl();
    var body = {
      ok: true,
      message: 'ON-AIR GFX Web App is running. Use POST to write data.',
      spreadsheet: name,
      spreadsheetUrl: url,
      hint: 'Data is written to this spreadsheet. If you expected a different sheet, add this script there (Extensions → Apps Script in that sheet).'
    };
    return ContentService.createTextOutput(JSON.stringify(body, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse(400, { ok: false, error: 'Missing POST body' });
    }
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
      if ((d.answer || '').trim()) text += '\n\n' + (d.answer || '').trim();
      if ((d.submitterName || '').trim()) text += '\n— ' + (d.submitterName || '').trim();
      qaSheet.getRange(data.cell).setValue(text);
      return jsonResponse(200, { ok: true });
    }

    // Append one Q&A submission to a backup sheet (one row per submission)
    if (data.type === 'qa_backup' && data.sheetName && data.data) {
      var backupSheet = getOrCreateSheet(ss, data.sheetName);
      var d = data.data;
      if (backupSheet.getLastRow() === 0) {
        backupSheet.getRange(1, 1, 1, 6).setValues([['Timestamp', 'Session ID', 'Question', 'Submitter', 'Email', 'Status']]);
        backupSheet.getRange(1, 1, 1, 6).setFontWeight('bold');
      }
      var nextRow = backupSheet.getLastRow() + 1;
      backupSheet.getRange(nextRow, 1, nextRow, 6).setValues([[
        d.timestamp || new Date().toISOString(),
        d.sessionId || '',
        (d.question || '').toString().slice(0, 50000),
        (d.submitterName || '').toString(),
        (d.submitterEmail || '').toString(),
        d.status || 'pending'
      ]]);
      return jsonResponse(200, { ok: true, sheetName: data.sheetName, row: nextRow });
    }

    // Append one poll snapshot to a backup sheet (one row per play/update)
    if (data.type === 'poll_backup' && data.sheetName && data.data) {
      var pollBackupSheet = getOrCreateSheet(ss, data.sheetName);
      var p = data.data;
      if (pollBackupSheet.getLastRow() === 0) {
        var header = ['Timestamp', 'Poll ID', 'Poll Title'];
        if (p.options && p.options.length) {
          p.options.forEach(function(opt, i) { header.push('Option ' + (i + 1)); header.push('Votes ' + (i + 1)); });
        }
        pollBackupSheet.getRange(1, 1, 1, header.length).setValues([header]);
        pollBackupSheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
      }
      var nextRow = pollBackupSheet.getLastRow() + 1;
      var row = [p.timestamp || new Date().toISOString(), p.id || '', (p.title || '').toString()];
      if (p.options && p.options.length) {
        p.options.forEach(function(opt) {
          row.push((opt.text || '').toString());
          row.push(opt.votes != null ? opt.votes : '');
        });
      }
      pollBackupSheet.getRange(nextRow, 1, nextRow, row.length).setValues([row]);
      return jsonResponse(200, { ok: true, sheetName: data.sheetName, row: nextRow, message: 'Appended to ' + data.sheetName + ' row ' + nextRow });
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
