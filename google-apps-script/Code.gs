// Code.gs — à coller dans Extensions > Apps Script du Google Sheet partagé
// Ce script expose le Sheet "Snippets" comme mini-API gratuite (GET = lire, POST = écrire)

const SHEET_NAME = 'Snippets';

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['trigger', 'content', 'folder']);
  }
  return sheet;
}

function doGet(e) {
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  data.shift(); // enlève l'en-tête
  const snippets = data
    .filter(row => row[0])
    .map(row => ({
      trigger: String(row[0]),
      content: String(row[1] || ''),
      folder: String(row[2] || '')
    }));
  return ContentService
    .createTextOutput(JSON.stringify(snippets))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const sheet = getSheet_();
  const body = JSON.parse(e.postData.contents);

  sheet.clearContents();
  sheet.appendRow(['trigger', 'content', 'folder']);
  body.forEach(s => {
    sheet.appendRow([s.trigger || '', s.content || '', s.folder || '']);
  });

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', count: body.length }))
    .setMimeType(ContentService.MimeType.JSON);
}
