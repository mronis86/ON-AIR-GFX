/**
 * ON-AIR GFX – Google Apps Script Web App
 * 
 * 1. Open your Google Sheet
 * 2. Extensions → Apps Script
 * 3. Delete any code in Code.gs and paste this entire file
 * 4. Save (Ctrl+S), then Deploy → New deployment
 * 5. Type: Web app. Execute as: Me. Who has access: Anyone
 * 6. Deploy and copy the Web App URL (URL should end with the path exec)
 * 7. Paste that URL into your event’s "Web App URL (for writing)" in ON-AIR GFX
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
      if ((d.answer || '').trim()) text += '\n\n' + (d.answer || '').trim();
      if ((d.submitterName || '').trim()) text += '\n— ' + (d.submitterName || '').trim();
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
