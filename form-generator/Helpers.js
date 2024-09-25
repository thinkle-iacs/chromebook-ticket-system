const getFieldColumnMap = (sheetName) => {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet not found: ' + sheetName);
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  let fieldDefinitions = [];

  if (sheetName === NODES_SHEET_NAME) {
    fieldDefinitions = NODE_FIELDS;
  } else if (sheetName === EDGES_SHEET_NAME) {
    fieldDefinitions = EDGE_FIELDS;
  } else if (sheetName === SETTINGS_SHEET_NAME) {
    fieldDefinitions = SETTINGS_FIELDS;
  }

  const fieldMap = {};
  fieldDefinitions.forEach((field) => {
    const colIndex = headers.indexOf(field.name);
    if (colIndex !== -1) {
      fieldMap[field.key] = colIndex + 1; // +1 because column indices are 1-based
    } else {
      throw new Error(`Field "${field.name}" not found in sheet: ${sheetName}`);
    }
  });

  return fieldMap;
};

const getColumnLetter = (columnNumber) => {
  let temp;
  let letter = '';
  while (columnNumber > 0) {
    temp = (columnNumber - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    columnNumber = (columnNumber - temp - 1) / 26;
  }
  return letter;
};
/**
 * Generates a unique node ID based on the given title.
 *
 * @param {string} title - The title of the section or question.
 * @param {Array<string>} existingIds - An array of existing node IDs to ensure uniqueness.
 * @returns {string} - A unique, formatted node ID.
 */
function getNewNodeId(title, existingIds=[]) {
  // Define a list of stopwords to remove from the title
  const stopwords = [
    'the', 'for', 'and', 'or', 'but', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'with', 'without',
    'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
    'did', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must'
  ];

  // Helper function to remove punctuation and convert to lowercase
  const preprocessTitle = (str) => {
    return str
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove punctuation
      .toLowerCase();
  };

  // Helper function to abbreviate a word by removing vowels except the first character
  const abbreviateWord = (word) => {
    if (word.length <= 3) return word.toUpperCase();
    const firstChar = word.charAt(0).toUpperCase();
    if (word.replace(/ing/,'').length > 3) {
      word = word.replace(/ing/,'')
    }
    const abbreviated = word
      .slice(1)
      .replace(/[aeiou]/g, '') // Remove vowels
      .toUpperCase();
    return firstChar + abbreviated;
  };

  // Step 1: Preprocess the title
  const cleanedTitle = preprocessTitle(title);

  // Step 2: Split the title into words and remove stopwords
  const words = cleanedTitle.split(/\s+/).filter(word => word && !stopwords.includes(word));

  // Step 3: Abbreviate each word
  const abbreviatedWords = words.map(word => abbreviateWord(word));

  // Step 4: Join the abbreviated words with underscores
  let baseId = abbreviatedWords.join('_');

  // Step 5: Ensure the ID is not empty; if empty, use a default prefix
  if (!baseId) {
    baseId = 'NODE';
  }

  // Step 6: Truncate the ID to a maximum length (e.g., 20 characters)
  const MAX_ID_LENGTH = 20;
  if (baseId.length > MAX_ID_LENGTH) {
    baseId = baseId.substring(0, MAX_ID_LENGTH);
  }

  // Step 7: Ensure uniqueness by appending a numerical suffix if necessary
  let uniqueId = baseId;
  let suffix = 1;
  while (existingIds.includes(uniqueId)) {
    // Calculate the maximum length for the base ID to accommodate the suffix
    const suffixStr = `_${suffix}`;
    const allowedLength = MAX_ID_LENGTH - suffixStr.length;
    uniqueId = baseId.substring(0, allowedLength) + suffixStr;
    suffix++;
  }

  return uniqueId;
}

function testID () {
  console.log(getNewNodeId("Hello World This is an Example",[]));
  console.log(getNewNodeId("Printing Troubleshooting", [getNewNodeId("Printing Troubleshooting")]));
}

