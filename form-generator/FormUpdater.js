/**
 * Updates the Google Form based on the Nodes and Edges sheets.
 * Adds new items without deleting existing ones and inserts them at the correct position.
 */
function updateForm() {
  const form = getForm();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nodesSheet = ss.getSheetByName(NODES_SHEET_NAME);
  const edgesSheet = ss.getSheetByName(EDGES_SHEET_NAME);

  const nodesData = nodesSheet.getDataRange().getValues();
  const edgesData = edgesSheet.getDataRange().getValues();

  if (nodesData.length < 2) {
    // No nodes to process
    return;
  }

  const fieldMap = getFieldColumnMap(NODES_SHEET_NAME);
  const edgesFieldMap = getFieldColumnMap(EDGES_SHEET_NAME);

  // Step 1: Read Nodes and Build Mappings
  const nodes = [];
  const nodeIdToNode = {};
  const nodeIdToFormItem = {};
  const googleIdToFormItem = {};
  const existingIds = []; // To track existing node IDs

  for (let i = 1; i < nodesData.length; i++) {
    const row = nodesData[i];
    const node = {};
    NODE_FIELDS.forEach((field) => {
      const colIndex = fieldMap[field.key] - 1; // -1 for zero-based index
      node[field.key] = row[colIndex];
    });
    nodes.push(node);
    nodeIdToNode[node.nodeId] = node;
    existingIds.push(node.nodeId);
  }

  // Step 2: Get Form Items and Build Mappings
  const formItems = form.getItems();
  formItems.forEach((item) => {
    googleIdToFormItem[item.getId().toString()] = item;
  });

  // Step 3: Update or Create Items
  nodes.forEach((node, i) => {
    let item;

    if (node.googleId && googleIdToFormItem[node.googleId.toString()]) {
      // Existing item
      item = googleIdToFormItem[node.googleId.toString()];
      // Update title and help text
      item.setTitle(node.text);
      item.setHelpText(node.description);
    } else {
      // New item
      if (node.type === 'Section') {
        item = form.addPageBreakItem()
          .setTitle(node.text)
          .setHelpText(node.description);
      } else if (node.type === 'Question') {
        item = form.addMultipleChoiceItem()
          .setTitle(node.text)
          .setHelpText(node.description);
      }
      // Update Google ID in sheet
      const rowIndex = i + 2; // +2 because headers + 1-based indexing
      nodesSheet.getRange(rowIndex, fieldMap['googleId']).setValue(item.getId());
      node.nodeId = node.nodeId || getNewNodeId(node.text, existingIds);
      nodeIdToFormItem[node.nodeId] = item;
    }
    nodeIdToFormItem[node.nodeId] = item;
  });

  // Step 4: Determine Desired Item Positions
  const desiredItemOrder = nodes; // Nodes are already in desired order based on the sheet

  // Build a mapping from nodeId to item index in desired order
  const nodeIdToDesiredIndex = {};
  desiredItemOrder.forEach((node, index) => {
    nodeIdToDesiredIndex[node.nodeId] = index;
  });

  // Get current form items in order
  const currentFormItems = form.getItems();
  const formItemIds = currentFormItems.map(item => item.getId().toString());

  // Step 5: Insert New Items at Correct Positions
  nodes.forEach((node, i) => {
    const item = nodeIdToFormItem[node.nodeId];
    const currentIndex = formItemIds.indexOf(item.getId().toString());
    const desiredIndex = i;

    if (currentIndex !== desiredIndex) {
      // Determine where to move the item
      let insertBeforeItem = null;

      // Find the next node in desired order that already exists in the form
      for (let j = desiredIndex + 1; j < desiredItemOrder.length; j++) {
        const nextNodeId = desiredItemOrder[j].nodeId;
        if (formItemIds.includes(nextNodeId)) {
          insertBeforeItem = form.getItemById(parseInt(nextNodeId));
          break;
        }
      }

      if (insertBeforeItem) {
        form.moveItem(item, form.getItems().indexOf(insertBeforeItem));
      } else {
        // If no subsequent item found, move to the end
        form.moveItem(item, form.getItems().length - 1);
      }

      // Update formItemIds to reflect the move
      formItemIds.splice(currentIndex, 1);
      if (insertBeforeItem) {
        const newIndex = form.getItems().indexOf(insertBeforeItem);
        formItemIds.splice(newIndex, 0, item.getId().toString());
      } else {
        formItemIds.push(item.getId().toString());
      }
    }
  });

  // Step 6: Process Edges to Set Up Choices and Navigation
  // Build mapping from sourceId to edges
  const sourceIdToEdges = {};
  for (let i = 1; i < edgesData.length; i++) {
    const row = edgesData[i];
    const edge = {};
    EDGE_FIELDS.forEach((field) => {
      const colIndex = edgesFieldMap[field.key] - 1; // -1 for zero-based index
      edge[field.key] = row[colIndex];
    });
    if (!sourceIdToEdges[edge.sourceId]) {
      sourceIdToEdges[edge.sourceId] = [];
    }
    sourceIdToEdges[edge.sourceId].push(edge);
  }

  // For each question node, set its choices
  nodes.forEach((node) => {
    if (node.type === 'Question') {
      const item = nodeIdToFormItem[node.nodeId];
      const edges = sourceIdToEdges[node.nodeId] || [];

      const choices = edges.map((edge) => {
        const choiceText = edge.choiceText;
        const destId = edge.destinationId;
        let navigationType = FormApp.PageNavigationType.CONTINUE;
        let destItem = null;

        if (destId === 'END') {
          navigationType = FormApp.PageNavigationType.SUBMIT;
        } else if (nodeIdToFormItem[destId]) {
          destItem = nodeIdToFormItem[destId];
          navigationType = destItem.asPageBreakItem();
        }
        return item.asMultipleChoiceItem().createChoice(choiceText, navigationType);
        //return item.createChoice(choiceText, navigationType);
        //return item.asMultipleChoiceItem().createChoice(choiceText, navigationType, destItem);
      });

      item.asMultipleChoiceItem().setChoices(choices);
    }
  });

  updateDataValidation();
}
function updateFormOld() {
  const form = getForm();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nodesSheet = ss.getSheetByName(NODES_SHEET_NAME);
  const edgesSheet = ss.getSheetByName(EDGES_SHEET_NAME);

  const nodesData = nodesSheet.getDataRange().getValues();
  const edgesData = edgesSheet.getDataRange().getValues();

  if (nodesData.length < 2) {
    // No nodes to process
    return;
  }

  const fieldMap = getFieldColumnMap(NODES_SHEET_NAME);
  const edgesFieldMap = getFieldColumnMap(EDGES_SHEET_NAME);

  // Step 1: Read Nodes and Build Mappings
  const nodes = [];
  const nodeIdToNode = {};
  const nodeIdToFormItem = {};
  const googleIdToFormItem = {};
  const sections = []; // List of section nodes

  for (let i = 1; i < nodesData.length; i++) {
    const row = nodesData[i];
    const node = {};
    NODE_FIELDS.forEach((field) => {
      const colIndex = fieldMap[field.key] - 1; // -1 for zero-based index
      node[field.key] = row[colIndex];
    });
    nodes.push(node);
    nodeIdToNode[node.nodeId] = node;

    if (node.type === 'Section') {
      sections.push(node);
    }
  }

  // Step 2: Get Form Items and Build Mappings
  const formItems = form.getItems();
  formItems.forEach((item) => {
    googleIdToFormItem[item.getId().toString()] = item;
  });

  // Step 3: Update or Create Items
  nodes.forEach((node, i) => {
    let item;

    if (node.googleId && googleIdToFormItem[node.googleId.toString()]) {
      // Existing item
      item = googleIdToFormItem[node.googleId.toString()];
      // Update title and help text
      item.setTitle(node.text);
      item.setHelpText(node.description);
    } else {
      // New item
      if (node.type === 'Section') {
        item = form.addPageBreakItem()
          .setTitle(node.text)
          .setHelpText(node.description);
      } else if (node.type === 'Question') {
        item = form.addMultipleChoiceItem()
          .setTitle(node.text)
          .setHelpText(node.description);
      }
      // Update Google ID in sheet
      const rowIndex = i + 2; // +2 because headers + 1-based indexing
      nodesSheet.getRange(rowIndex, fieldMap['googleId']).setValue(item.getId());
      node.googleId = item.getId().toString();
    }
    nodeIdToFormItem[node.nodeId] = item;
  });

  // Step 4: Determine Desired Item Positions
  const desiredItemOrder = [];

  // Build desired order based on sections and their child nodes
  sections.forEach((section) => {
    desiredItemOrder.push(section);

    // Get all child nodes under this section
    const childNodes = nodes.filter((n) => n.parentId === section.nodeId);
    desiredItemOrder.push(...childNodes);
  });

  // Add nodes without a parent or section
  const unparentedNodes = nodes.filter((n) => !n.parentId && n.type !== 'Section');
  desiredItemOrder.push(...unparentedNodes);

  // Step 5: Move Items to Correct Positions
  const formItemIds = form.getItems().map((item) => item.getId().toString());
  desiredItemOrder.forEach((node, desiredIndex) => {
    const item = nodeIdToFormItem[node.nodeId];
    const currentIndex = formItemIds.indexOf(item.getId().toString());

    if (currentIndex !== desiredIndex) {
      // Move item to the correct position
      form.moveItem(currentIndex, desiredIndex);
      // Update formItemIds to reflect the move
      formItemIds.splice(currentIndex, 1);
      formItemIds.splice(desiredIndex, 0, item.getId().toString());
    }
  });

  // Step 6: Process Edges to Set Up Choices and Navigation
  // Build mapping from sourceId to edges
  const sourceIdToEdges = {};
  for (let i = 1; i < edgesData.length; i++) {
    const row = edgesData[i];
    const edge = {};
    EDGE_FIELDS.forEach((field) => {
      const colIndex = edgesFieldMap[field.key] - 1; // -1 for zero-based index
      edge[field.key] = row[colIndex];
    });
    if (!sourceIdToEdges[edge.sourceId]) {
      sourceIdToEdges[edge.sourceId] = [];
    }
    sourceIdToEdges[edge.sourceId].push(edge);
  }

  // For each question node, set its choices
  nodes.forEach((node) => {
    if (node.type === 'Question') {
      const item = nodeIdToFormItem[node.nodeId];
      const edges = sourceIdToEdges[node.nodeId] || [];

      const choices = edges.map((edge) => {
        const choiceText = edge.choiceText;
        const destId = edge.destinationId;
        const destItem = nodeIdToFormItem[destId];
       
        let navigationType = FormApp.PageNavigationType.CONTINUE;
        if (destId === 'END') {
          navigationType = FormApp.PageNavigationType.SUBMIT;
        } else if (destItem) {
          navigationType = destItem.asPageBreakItem();
        }
        return item.asMultipleChoiceItem().createChoice(choiceText, navigationType);
        //return item.createChoice(choiceText, navigationType);
      });

      item.asMultipleChoiceItem().setChoices(choices);
    }
  });

  updateDataValidation();
}