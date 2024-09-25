function setupSettingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let settingsSheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet(SETTINGS_SHEET_NAME, 0);
  }

  // Check if headers are present
  const existingHeaders = settingsSheet.getRange(1, 1, 1, 2).getValues()[0];
  const expectedHeaders = ['Setting', 'Value'];

  if (existingHeaders[0] !== expectedHeaders[0] || existingHeaders[1] !== expectedHeaders[1]) {
    // Add or correct headers
    settingsSheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
  }

  // Check if 'Form URL' setting exists
  const settingsData = settingsSheet.getDataRange().getValues();
  let formURLFound = false;
  for (let i = 2; i <= settingsData.length; i++) {
    if (settingsSheet.getRange(i, 1).getValue() === SETTINGS_FORM_URL_KEY) {
      formURLFound = true;
      break;
    }
  }

  if (!formURLFound) {
    // Add 'Form URL' setting
    settingsSheet.appendRow([SETTINGS_FORM_URL_KEY, '']);
  }
}

function getForm() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!settingsSheet) {
    throw new Error('Settings sheet not found. Please run setupSettingsSheet() first.');
  }

  const settingsData = settingsSheet.getDataRange().getValues();
  const settings = {};
  for (let i = 1; i < settingsData.length; i++) {
    const key = settingsData[i][0];
    const value = settingsData[i][1];
    settings[key] = value;
  }

  const formURL = settings[SETTINGS_FORM_URL_KEY];

  if (formURL) {
    return FormApp.openByUrl(formURL);
  } else {
    // Create a new form if no URL is provided
    const form = FormApp.create('Troubleshooting Form');
    settingsSheet.getRange(settingsSheet.getLastRow() + 1, 1).setValue(SETTINGS_FORM_URL_KEY);
    settingsSheet.getRange(settingsSheet.getLastRow(), 2).setValue(form.getEditUrl());
    return form;
  }
}