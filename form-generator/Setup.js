function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Form Tools')
    .addItem('Setup Sheets', 'setupAllSheets')
    .addItem('Reset Sheets', 'resetAllSheets')
    .addSeparator()
    .addItem('Read Form', 'readForm')
    .addItem('Update Form', 'updateForm')
    .addToUi();
}