/**
 * Reads the form structure and populates the Nodes and Edges sheets without using parent relationships.
 */
function readForm() {
  const form = getForm();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nodesSheet = ss.getSheetByName(NODES_SHEET_NAME);
  const edgesSheet = ss.getSheetByName(EDGES_SHEET_NAME);

  // Optional: Prompt user before clearing sheets
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Confirm',
    'This action will clear existing data in the Nodes and Edges sheets. Do you want to proceed?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    ui.alert('Operation cancelled.');
    return;
  }

  // Clear existing data and set up sheets
  nodesSheet.clear();
  edgesSheet.clear();
  setupNodesSheet();
  setupEdgesSheet();

  const fieldMap = getFieldColumnMap(NODES_SHEET_NAME);
  const edgesFieldMap = getFieldColumnMap(EDGES_SHEET_NAME);

  const items = form.getItems();
  const nodes = [];
  const edges = [];
  const nodeIds = [];
  const nodeIdMap = {};

  // -------------------------------
  // First Pass: Collect all nodes
  // -------------------------------
  items.forEach((item) => {
    const node = {};
    node.googleId = item.getId();
    node.text = item.getTitle();
    node.description = item.getHelpText();

    if (item.getType() === FormApp.ItemType.PAGE_BREAK) {
      node.type = 'Section';
    } else if (item.getType() === FormApp.ItemType.MULTIPLE_CHOICE) {
      node.type = 'Question';
    } else {
      // Skip other item types if not handled
      return;
    }

    // Generate a unique nodeId
    node.nodeId = getNewNodeId(node.text, nodeIds);
    nodeIds.push(node.nodeId);

    nodes.push(node);
    nodeIdMap[item.getId().toString()] = node.nodeId;
  });

  // -------------------------------
  // Second Pass: Process edges
  // -------------------------------
  items.forEach((item) => {
    if (item.getType() === FormApp.ItemType.MULTIPLE_CHOICE) {
      const node = nodes.find(n => n.googleId === item.getId());
      if (!node) return; // Safety check

      const choices = item.asMultipleChoiceItem().getChoices();
      choices.forEach((choice) => {
        const edge = {};
        edge.sourceId = node.nodeId;
        edge.choiceText = choice.getValue();
        const navType = choice.getPageNavigationType();

        if (navType === FormApp.PageNavigationType.GO_TO_PAGE) {
          const destItem = choice.getGotoPage();
          if (destItem) {
            const destItemId = destItem.getId();
            const destNodeId = nodeIdMap[destItemId.toString()];
            if (destNodeId) {
              edge.destinationId = destNodeId;
            } else {
              // Handle case where destination section is not found
              edge.destinationId = 'UNKNOWN_SECTION';
              Logger.log(`Destination section not found for choice: "${choice.getValue()}" in question "${node.text}"`);
            }
          } else {
            edge.destinationId = 'UNKNOWN_SECTION';
            Logger.log(`GoToPage is undefined for choice: "${choice.getValue()}" in question "${node.text}"`);
          }
        } else if (navType === FormApp.PageNavigationType.SUBMIT) {
          edge.destinationId = 'END';
        } else {
          edge.destinationId = ''; // For CONTINUE or other types
        }

        edges.push(edge);
      });
    }
  });

  // -------------------------------
  // Write Nodes to Sheet
  // -------------------------------
  if (nodes.length > 0) {
    const nodeValues = nodes.map((node) => {
      return NODE_FIELDS.map((field) => node[field.key] || '');
    });
    nodesSheet.getRange(2, 1, nodeValues.length, nodeValues[0].length).setValues(nodeValues);
  }

  // -------------------------------
  // Write Edges to Sheet
  // -------------------------------
  if (edges.length > 0) {
    const edgeValues = edges.map((edge) => {
      return EDGE_FIELDS.map((field) => edge[field.key] || '');
    });
    edgesSheet.getRange(2, 1, edgeValues.length, edgeValues[0].length).setValues(edgeValues);
  }

  // -------------------------------
  // Update Data Validation
  // -------------------------------
  updateDataValidation();

  // Inform the user of successful operation
  ui.alert('Read Form', 'The form has been successfully read and the Nodes and Edges sheets have been updated.', ui.ButtonSet.OK);
}

/**
 * Reads the form structure and populates the Nodes and Edges sheets.
 */
function readFormOld() {
  const form = getForm();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nodesSheet = ss.getSheetByName(NODES_SHEET_NAME);
  const edgesSheet = ss.getSheetByName(EDGES_SHEET_NAME);

  // Optional: Prompt user before clearing sheets
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Confirm',
    'This action will clear existing data in the Nodes and Edges sheets. Do you want to proceed?',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    ui.alert('Operation cancelled.');
    return;
  }

  nodesSheet.clear();
  edgesSheet.clear();
  setupNodesSheet();
  setupEdgesSheet();

  const fieldMap = getFieldColumnMap(NODES_SHEET_NAME);
  const edgesFieldMap = getFieldColumnMap(EDGES_SHEET_NAME);

  const items = form.getItems();
  const nodes = [];
  const edges = [];
  const nodeIds = [];
  const nodeIdMap = {};

  // First Pass: Collect all nodes and populate nodeIdMap
  let lastSectionId = null;

  items.forEach((item) => {
    const node = {};
    node.googleId = item.getId();
    node.text = item.getTitle();
    node.description = item.getHelpText();

    if (item.getType() === FormApp.ItemType.PAGE_BREAK) {
      node.type = 'Section';
      const sectionTitle = item.getTitle();
      node.nodeId = getNewNodeId(sectionTitle, nodeIds);
      nodeIds.push(node.nodeId);
      node.parentId = ''; // Sections have no parent
      lastSectionId = node.nodeId;
      nodes.push(node);
      nodeIdMap[item.getId()] = node.nodeId;
    } else if (item.getType() === FormApp.ItemType.MULTIPLE_CHOICE) {
      node.type = 'Question';
      const questionTitle = item.getTitle();
      node.nodeId = getNewNodeId(questionTitle, nodeIds);
      nodeIds.push(node.nodeId);
      node.parentId = lastSectionId; // Assign to the last section
      nodes.push(node);
      nodeIdMap[item.getId()] = node.nodeId;
    }
    // Add more item types if necessary
  });

  // Second Pass: Process edges based on choices
  items.forEach((item) => {
    if (item.getType() === FormApp.ItemType.MULTIPLE_CHOICE) {
      const node = nodes.find(n => n.googleId === item.getId());
      if (!node) return; // Safety check

      const choices = item.asMultipleChoiceItem().getChoices();
      choices.forEach((choice) => {
        const edge = {};
        edge.sourceId = node.nodeId;
        edge.choiceText = choice.getValue();
        const navType = choice.getPageNavigationType();

        if (navType === FormApp.PageNavigationType.GO_TO_PAGE) {
          const destItem = choice.getGotoPage();
          if (destItem) {
            const destItemId = destItem.getId();
            const destNodeId = nodeIdMap[destItemId];
            if (destNodeId) {
              edge.destinationId = destNodeId;
            } else {
              // Handle case where destination section is not found
              edge.destinationId = 'UNKNOWN_SECTION';
              Logger.log(`Destination section not found for choice: "${choice.getValue()}" in question "${node.text}"`);
            }
          } else {
            edge.destinationId = 'UNKNOWN_SECTION';
            Logger.log(`GoToPage is undefined for choice: "${choice.getValue()}" in question "${node.text}"`);
          }
        } else if (navType === FormApp.PageNavigationType.SUBMIT) {
          edge.destinationId = 'END';
        } else {
          edge.destinationId = ''; // For CONTINUE or other types
        }
        edges.push(edge);
      });
    }
  });

  // Write nodes to sheet
  if (nodes.length > 0) {
    const nodeValues = nodes.map((node) => {
      return NODE_FIELDS.map((field) => node[field.key] || '');
    });
    nodesSheet.getRange(2, 1, nodeValues.length, nodeValues[0].length).setValues(nodeValues);
  }

  // Write edges to sheet
  if (edges.length > 0) {
    const edgeValues = edges.map((edge) => {
      return EDGE_FIELDS.map((field) => edge[field.key] || '');
    });
    edgesSheet.getRange(2, 1, edgeValues.length, edgeValues[0].length).setValues(edgeValues);
  }

  updateDataValidation();
}