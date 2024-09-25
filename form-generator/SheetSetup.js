function setupAllSheets() {
  setupSettingsSheet();
  setupNodesSheet();
  setupEdgesSheet();
  updateDataValidation();
}
function resetAllSheets() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Reset All Sheets',
    'This will delete all data in the Settings, Nodes, and Edges sheets. Do you want to proceed?',
    ui.ButtonSet.YES_NO
  );

  if (response == ui.Button.YES) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetsToDelete = [SETTINGS_SHEET_NAME, NODES_SHEET_NAME, EDGES_SHEET_NAME];
    sheetsToDelete.forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        ss.deleteSheet(sheet);
      }
    });
    setupAllSheets();
  }
}

function setupNodesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let nodesSheet = ss.getSheetByName(NODES_SHEET_NAME);
  if (!nodesSheet) {
    nodesSheet = ss.insertSheet(NODES_SHEET_NAME);
  }

  // Check if headers are present
  const existingHeaders = nodesSheet.getLastColumn() > 1 && nodesSheet.getRange(1, 1, 1, nodesSheet.getLastColumn()).getValues()[0] || [];
  const expectedHeaders = NODE_FIELDS.map(field => field.name);

  if (existingHeaders.length < expectedHeaders.length || existingHeaders.some((header, index) => header !== expectedHeaders[index])) {
    // Add or correct headers
    nodesSheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
  }

  // Set up data validation
  const fieldMap = getFieldColumnMap(NODES_SHEET_NAME);
  const typeColIndex = fieldMap['type'];

  const typeRange = nodesSheet.getRange(2, typeColIndex, nodesSheet.getMaxRows() - 1);
  const typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Section', 'Question'], true)
    .build();
  typeRange.setDataValidation(typeRule);
}

function setupEdgesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let edgesSheet = ss.getSheetByName(EDGES_SHEET_NAME);
  if (!edgesSheet) {
    edgesSheet = ss.insertSheet(EDGES_SHEET_NAME);
  }

  // Check if headers are present
  const existingHeaders = edgesSheet.getLastColumn() > 1 && edgesSheet.getRange(1, 1, 1, edgesSheet.getLastColumn()).getValues()[0] || [];
  const expectedHeaders = EDGE_FIELDS.map(field => field.name);

  if (existingHeaders.length < expectedHeaders.length || existingHeaders.some((header, index) => header !== expectedHeaders[index])) {
    // Add or correct headers
    edgesSheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
  }

  // Data validation for 'Source ID' and 'Destination ID' columns can be added here
}
function updateDataValidation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nodesSheet = ss.getSheetByName(NODES_SHEET_NAME);
  const edgesSheet = ss.getSheetByName(EDGES_SHEET_NAME);

  if (!nodesSheet || !edgesSheet) {
    throw new Error('Nodes or Edges sheet not found.');
  }

  // Create or clear the DataValidation sheet
  let dataValidationSheet = ss.getSheetByName('DataValidation');
  if (!dataValidationSheet) {
    dataValidationSheet = ss.insertSheet('DataValidation');
    dataValidationSheet.hideSheet(); // Hide the sheet
  } else {
    dataValidationSheet.clear();
  }

  // Get the data from the Nodes sheet
  const nodesData = nodesSheet.getDataRange().getValues();
  const fieldMap = getFieldColumnMap(NODES_SHEET_NAME);

  const nodeIdColLetter = getColumnLetter(fieldMap['nodeId']);
  const typeColLetter = getColumnLetter(fieldMap['type']);
  const nodesSheetNameQuoted = `'${NODES_SHEET_NAME}'`; // Enclose in single quotes

  // In DataValidation sheet, set up formulas to filter Question IDs
  dataValidationSheet.getRange('A1').setFormula(
    `=FILTER(${nodesSheetNameQuoted}!${nodeIdColLetter}2:${nodeIdColLetter}, ${nodesSheetNameQuoted}!${typeColLetter}2:${typeColLetter}="Question")`
  );

  // Set up formulas to filter Section IDs
  dataValidationSheet.getRange('B1').setFormula(
    `=FILTER(${nodesSheetNameQuoted}!${nodeIdColLetter}2:${nodeIdColLetter}, ${nodesSheetNameQuoted}!${typeColLetter}2:${typeColLetter}="Section")`
  );

  // Set up formulas to combine Section IDs with 'END' keyword for Destination IDs
  // We'll use Column C for Destination IDs
  dataValidationSheet.getRange('C1').setFormula(
    `={FILTER(${nodesSheetNameQuoted}!${nodeIdColLetter}2:${nodeIdColLetter}, ${nodesSheetNameQuoted}!${typeColLetter}2:${typeColLetter}="Section"); "END"}`
  );

  // Set named ranges for validation
  const questionRange = dataValidationSheet.getRange('A:A');
  ss.setNamedRange(NAMED_RANGE_QUESTION_IDS, questionRange);

  const sectionRange = dataValidationSheet.getRange('B:B');
  ss.setNamedRange(NAMED_RANGE_SECTION_IDS, sectionRange);

  const destinationRange = dataValidationSheet.getRange('C:C');
  ss.setNamedRange(NAMED_RANGE_DESTINATION_IDS, destinationRange);

  // Apply data validation to Edges sheet
  const edgesFieldMap = getFieldColumnMap(EDGES_SHEET_NAME);
  const sourceIdColIndex = edgesFieldMap['sourceId'];
  const destinationIdColIndex = edgesFieldMap['destinationId'];

  const lastRowEdges = edgesSheet.getLastRow() >= 2 ? edgesSheet.getLastRow() : 2;
  const sourceRange = edgesSheet.getRange(2, sourceIdColIndex, lastRowEdges - 1);
  const destinationRangeSheet = edgesSheet.getRange(2, destinationIdColIndex, lastRowEdges - 1);

  // Create validation rules
  const questionIdsRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(ss.getRange(NAMED_RANGE_QUESTION_IDS), true)
    .build();

  const destinationIdsRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(ss.getRange(NAMED_RANGE_DESTINATION_IDS), true)
    .build();

  // Set data validation in Edges sheet
  sourceRange.setDataValidation(questionIdsRule);
  destinationRangeSheet.setDataValidation(destinationIdsRule);

  // No need for parent ID validation since "parent" is removed
}
function updateDataValidationOld() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nodesSheet = ss.getSheetByName(NODES_SHEET_NAME);
  const edgesSheet = ss.getSheetByName(EDGES_SHEET_NAME);

  if (!nodesSheet || !edgesSheet) {
    throw new Error('Nodes or Edges sheet not found.');
  }

  // Create or clear the DataValidation sheet
  let dataValidationSheet = ss.getSheetByName('DataValidation');
  if (!dataValidationSheet) {
    dataValidationSheet = ss.insertSheet('DataValidation');
    dataValidationSheet.hideSheet(); // Hide the sheet
  } else {
    dataValidationSheet.clear();
  }

  // Get the data from the Nodes sheet
  const nodesData = nodesSheet.getDataRange().getValues();
  const fieldMap = getFieldColumnMap(NODES_SHEET_NAME);

  const nodeIdColLetter = getColumnLetter(fieldMap['nodeId']);
  const typeColLetter = getColumnLetter(fieldMap['type']);
  const nodesSheetNameQuoted = `'${NODES_SHEET_NAME}'`; // Enclose in single quotes

  // In DataValidation sheet, set up formulas to filter Question IDs
  dataValidationSheet.getRange('A1').setFormula(
    `=FILTER(${nodesSheetNameQuoted}!${nodeIdColLetter}2:${nodeIdColLetter}, ${nodesSheetNameQuoted}!${typeColLetter}2:${typeColLetter}="Question")`
  );

  // Set up formulas to filter Section IDs
  dataValidationSheet.getRange('B1').setFormula(
    `=FILTER(${nodesSheetNameQuoted}!${nodeIdColLetter}2:${nodeIdColLetter}, ${nodesSheetNameQuoted}!${typeColLetter}2:${typeColLetter}="Section")`
  );

  // Set up formulas to combine Section IDs with 'END' keyword for Destination IDs
  // We'll use Column C for Destination IDs
  dataValidationSheet.getRange('C1').setFormula(
    `={FILTER(${nodesSheetNameQuoted}!${nodeIdColLetter}2:${nodeIdColLetter}, ${nodesSheetNameQuoted}!${typeColLetter}2:${typeColLetter}="Section"); "END"}`
  );

  // Set named ranges for validation
  const questionRange = dataValidationSheet.getRange('A:A');
  ss.setNamedRange(NAMED_RANGE_QUESTION_IDS, questionRange);

  const sectionRange = dataValidationSheet.getRange('B:B');
  ss.setNamedRange(NAMED_RANGE_SECTION_IDS, sectionRange);

  const destinationRange = dataValidationSheet.getRange('C:C');
  ss.setNamedRange(NAMED_RANGE_DESTINATION_IDS, destinationRange);

  // Apply data validation to Edges sheet
  const edgesFieldMap = getFieldColumnMap(EDGES_SHEET_NAME);
  const sourceIdColIndex = edgesFieldMap['sourceId'];
  const destinationIdColIndex = edgesFieldMap['destinationId'];

  const lastRowEdges = edgesSheet.getLastRow() >= 2 ? edgesSheet.getLastRow() : 2;
  const sourceRange = edgesSheet.getRange(2, sourceIdColIndex, lastRowEdges - 1);
  const destinationRangeSheet = edgesSheet.getRange(2, destinationIdColIndex, lastRowEdges - 1);

  // Create validation rules
  const questionIdsRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(ss.getRange(NAMED_RANGE_QUESTION_IDS), true)
    .build();

  const destinationIdsRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(ss.getRange(NAMED_RANGE_DESTINATION_IDS), true)
    .build();

  // Set data validation in Edges sheet
  sourceRange.setDataValidation(questionIdsRule);
  destinationRangeSheet.setDataValidation(destinationIdsRule);

  // Apply data validation to Nodes sheet's Parent ID column
  const parentIdColIndex = fieldMap['parentId'];
  const parentRange = nodesSheet.getRange(2, parentIdColIndex, nodesSheet.getMaxRows() - 1);

  const sectionIdsRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(ss.getRange(NAMED_RANGE_SECTION_IDS), true)
    .build();

  parentRange.setDataValidation(sectionIdsRule);

  // Optional: Hide Column C if you want to keep DataValidation sheet tidy
  dataValidationSheet.hideColumn(dataValidationSheet.getRange('C:C'));
}