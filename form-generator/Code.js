// Constants.js

// Sheet Names
const SETTINGS_SHEET_NAME = 'Settings';
const NODES_SHEET_NAME = 'Nodes';
const EDGES_SHEET_NAME = 'Edges';

// Node Fields
const NODE_FIELDS = [
  { name: 'Node ID', key: 'nodeId' },
  { name: 'Type', key: 'type' },
  //{ name: 'Parent ID', key: 'parentId' },
  { name: 'Text', key: 'text' },
  { name: 'Description', key: 'description' },
  { name: 'Google ID', key: 'googleId' }
];

// Edge Fields
const EDGE_FIELDS = [
  { name: 'Source ID', key: 'sourceId' },
  { name: 'Choice Text', key: 'choiceText' },
  { name: 'Destination ID', key: 'destinationId' },
];

// Settings Fields
const SETTINGS_FIELDS = [
  { name: 'Setting', key: 'setting' },
  { name: 'Value', key: 'value' }
];

// Settings Key
const SETTINGS_FORM_URL_KEY = 'Form URL';

// Data Validation Named Ranges
const NAMED_RANGE_NODE_IDS = 'NodeIDs';
const NAMED_RANGE_SECTION_IDS = 'SectionIDs';
const NAMED_RANGE_QUESTION_IDS = 'QuestionIDs';
const NAMED_RANGE_DESTINATION_IDS = 'DestinationIDs';