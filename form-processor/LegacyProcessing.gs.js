/**
 * Legacy spreadsheet-based processing functions.
 * These were moved out of Code.js during Airtable migration.
 * To re-enable legacy flow, ensure onFormSubmit calls processResponseSheetsLegacy.
 */

// Legacy urgency mapping
function processUrgency(urgencyText) {
  if (Array.isArray(urgencyText)) {
    urgencyText = urgencyText[0];
  }
  if (!urgencyText) { return 0; }
  const lower = urgencyText.toLowerCase();
  if (lower.includes('unusable')) return 3;
  if (lower.includes('hard')) return 2;
  return 1;
}

function processProblem(problemText) {
  if (Array.isArray(problemText)) {
    let text = '';
    for (let p of problemText) {
      let problemPart = processProblem(p);
      if (problemPart) { text += problemPart; }
      return text;
    }
  }
  let keywords = [
    'broken', 'wet', 'printer', 'dead', "won't turn on", 'internet',
    "won't load", "charger", "program or page isn't working", "password"
  ];
  for (let keyword of keywords) {
    if (problemText.includes(keyword)) {
      return keyword;
    }
  }
  return problemText;
}

function processDescription(responseMap) {
  let mainDescription = responseMap['Problem Description'];
  let damageInfo = responseMap['Damage Info'];
  let incidentDescription = responseMap['Incident Description'];
  if (incidentDescription) { incidentDescription = 'Incident: ' + incidentDescription; }
  let parts = [mainDescription, damageInfo, incidentDescription];
  let descriptions = [];
  for (let p of parts) {
    if (Array.isArray(p)) {
      for (let item of p) { if (item) { descriptions.push(item); } }
    } else if (p) { descriptions.push(p); }
  }
  return descriptions.join('\n');
}

let schedData = null;
function getSchedData() {
  if (schedData) { return schedData; }
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('StudentSchedules');
  let LASID = 0, ADV = 1, FREE = 2;
  let data = sheet.getDataRange().getValues();
  schedData = {};
  for (let rn = 1; rn < data.length; rn++) {
    let row = data[rn];
    let key = row[LASID];
    let adv = row[ADV];
    let free = row[FREE];
    schedData[key] = { adv, free };
  }
  return schedData;
}
function testGetSchedData() {
  let d = getSchedData();
  console.log('Got schedule data e.g.', d[2689]);
  console.log(schedData);
}
function lookupStudentScheduleInfo({ LASID }) {
  if (!LASID) { return {}; }
  let scheduleLookup = getSchedData();
  return scheduleLookup[LASID] || scheduleLookup[Number(LASID)] || {};
}

function processResponseSheetsLegacy(r, processedData = undefined) {
  if (!processedData) { processedData = getProcessedData(); }
  if (processedData[r.getId()]) {
    console.warn('Already processed', r, processedData.getRow(r.getId()));
    return;
  }
  let responseMap = getResponseMap(r, ['Email Address', 'Email', 'Asset Tag', ...fields]);
  let rawEmail = responseMap['Email Address'][0];
  let formUser = responseMap['formUser'][0];
  if (responseMap['Email']) { rawEmail = responseMap['Email'][0]; }
  let rawName = responseMap['Name'][0];
  let rawAsset = responseMap['Asset Tag'][0];
  let atStudentUser = lookupStudentUser(rawEmail);
  let atStudentScheduleInfo = atStudentUser ? lookupStudentScheduleInfo(atStudentUser) : {};
  let atUser = atStudentUser || {};
  if (!atStudentUser) { atUser = lookupStaffUser(rawEmail) || {}; }
  let stampDate = new Date(r.getTimestamp());
  let timestamp = stampDate.toLocaleDateString() + ' ' + stampDate.toLocaleTimeString();
  let editUrl = r.getEditResponseUrl();
  let atAsset = lookupAsset(rawAsset);
  let newRecord = {
    ...responseMap,
    id: r.getId(),
    timestamp,
    FormName: rawName,
    SubmittedBy: formUser,
    FormEmail: rawEmail,
    FormAsset: rawAsset,
    Description: processDescription(responseMap),
    Problem: processProblem(responseMap['What is the problem with your chromebook?']),
    ...atUser,
    ...atAsset,
    ...atStudentScheduleInfo,
    'Advisory': (atStudentScheduleInfo && atStudentScheduleInfo.adv),
    'Free Blocks': (atStudentScheduleInfo && atStudentScheduleInfo.free),
    Edit: editUrl,
    UrgentCode: processUrgency(responseMap['Computer Status']),
    Urgency: responseMap['Computer Status'] || 'All set'
  };
  newRecord.Grade = getSchool(newRecord.YOG);
  console.log('Pushing record to sheet:', newRecord);
  processedData.pushRow(newRecord);
  sendToChat(newRecord);
}

function fillDropdownInColumnCFromRow2() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Processed Responses');
  const lastRow = sheet.getLastRow();
  const validationSourceRange = sheet.getRange(2, 3);
  const validationRule = validationSourceRange.getDataValidation();
  if (validationRule && lastRow > 2) {
    const targetRange = sheet.getRange(3, 3, lastRow - 2, 1);
    targetRange.setDataValidation(validationRule);
  } else {
    Logger.log('No validation rule found or no rows');
  }
}

function formatAssetLink(assetTag) {
  if (Array.isArray(assetTag)) { assetTag = assetTag.join(' '); }
  if (assetTag.trim().includes(' ')) { return assetTag; }
  return `<a href="https://cb.innovationcharter.org/asset/${assetTag}">${assetTag}</a>`;
}

function getSchool(YOG) {
  if (!YOG) { return ''; }
  YOG = Number(YOG);
  let d = new Date();
  let currentYear = d.getFullYear();
  let seniorYOG = d.getMonth() >= 6 ? currentYear + 1 : currentYear;
  let grade = seniorYOG - YOG + 12;
  let school = grade >= 9 ? 'HS' : (grade >= 5 && grade <= 8 ? 'MS' : '?');
  return `${school} (${grade}th, '${YOG.toString().slice(2)})`;
}
function testGetSchool() {
  ['2025', '2030', '2032', '2027', '2026'].forEach(YOG => console.log(`${YOG} => ${getSchool(YOG)}`));
}

function getEmailForRow(record) {
  let links = '';
  let email = fixEmail(record.FormEmail);
  if (email) { links += `<a href="mailto:${email}">Email user</a>`; }
  if (record.AdvisorEmails) {
    let advisorEmails = fixEmail(record.AdvisorEmails);
    links += `\n<a href="mailto:${email},${advisorEmails}">Email user + advisor</a>`;
    if (record.Contacts) {
      let contactEmails = record.Contacts;
      links += `\n<a href="mailto:${email},${advisorEmails},${contactEmails}">Email user + advisor + family</a>`;
    }
  }
  return links;
}

function sendToChat(record) {
  if (record.UrgentCode >= 1) {
    let priorities = ['None', 'Low (Usable)', 'Medium (Semi-Usable)', 'High (Unusable)'];
    let title = `New Chromebook Ticket - Priority ${priorities[record.UrgentCode]}`;
    let user = fixEmail(record.FormEmail);
    let extraRows = [];
    if (record.FormEmail != record.SubmittedBy) { user += ' (submitted by ' + record.SubmittedBy + ')'; }
    if (record.FormName) { extraRows.push('Name: ' + record.FormName); }
    if (record.Grade) { extraRows.push(record.Grade); }
    if (record.Advisor) { user += ` (Advisor: ${record.Advisor})`; }
    if (record.Role) { user += ` (${record.School} ${record.Role})`; }
    if (record['Asset Tag']) {
      let assetRow = `<b>Asset Tag</b>: ${formatAssetLink(record['Asset Tag'])} (<i>as reported by user</i>)`;
      if (record.Make || record.Model || record.Serial) {
        assetRow += `\n<b>Inventory Info</b> ${record.Make || '?'} ${record.Model || '?'} (${record.Serial || '?'})`;
      }
      extraRows.push(assetRow);
    }
    if (record['Signed Out Assets']) { extraRows.push(`User has signed out: ${record['Signed Out Assets'].join(', ')}`); }
    if (record.Location || record['Appointment Notes'] || record.adv || record.free) {
      let findThem = ['<b>Where to find them:</b>'];
      if (record.Location) { findThem.push('<i>Currently in</i> ' + record.Location.join(',')); }
      if (record.adv) { findThem.push('<i>Advisory: </i>' + record.adv); }
      if (record.free) { findThem.push('<i>Study blocks:</i> ' + record.free); }
      if (record['Appointment Notes']) { findThem.push('<i>Notes from student: </i>' + record['Appointment Notes']); }
      extraRows.push(findThem.join('\n'));
    }
    extraRows.push(`<b>Problem:</b> ${record.Problem}\n<b>Description:</b> ${record.Description}`);
    extraRows.push(getEmailForRow(record));
    if (record.FormName != record.Name) {
      extraRows.push('Name in form: ' + record.FormName);
      extraRows.push('vs. Name via email: ' + record.Name);
    }
    extraRows.push(`<a href="${record.Edit}">Edit this response</a> (will push it onto the list again)`);
    extraRows.push(`Manage this ticket in <a href="${SPREADSHEET_URL}">the ticket spreadsheet.</a>`);
    let image = pickTicketImage(record.Problem || record.Description);
    sendCardMessageToGoogleChat(title, user, extraRows, image);
  }
}

function lookupStaffUser(email) {
  email = fixEmail(email);
  let records = listRecords(StaffEndpoint, ['Full Name', 'Role', 'School (Short)', 'Email', 'Asset Tag'], filterByFormula = `LOWER(Email)=LOWER("${email}")`);
  if (records && records.length) {
    let theRecord = records[0].fields;
    if (theRecord['Asset Tag']) {
      theRecord['Signed Out Assets'] = theRecord['Asset Tag'];
      delete theRecord['Asset Tag'];
    }
    theRecord.Name = theRecord['Full Name'];
    theRecord.School = theRecord['School (Short)'];
    return theRecord;
  }
  return null;
}

function lookupStudentUser(email) {
  if (!email) return null;
  email = fixEmail(email);
  let records = listRecords(StudentEndpoint, ['LASID', 'Name', 'YOG', 'Advisor', 'Email', 'Asset Tag', 'Contact1Email', 'Contact2Email'], filterByFormula = `LOWER(Email)=LOWER("${email}")`);
  if (records && records.length) {
    let theRecord = records[0].fields;
    if (theRecord['Asset Tag']) {
      theRecord['Signed Out Assets'] = theRecord['Asset Tag'];
      delete theRecord['Asset Tag'];
    }
    theRecord.Contacts = [];
    if (theRecord.Contact1Email) { theRecord.Contacts = [...theRecord.Contact1Email]; }
    if (theRecord.Contact2Email) { theRecord.Contacts = [...theRecord.Contacts, ...theRecord.Contact2Email]; }
    let advisorRecords = listRecords(StaffEndpoint, ['Email'], filterByFormula = `LOWER(Advisory)=LOWER("${theRecord.Advisor}")`);
    theRecord.AdvisorEmails = advisorRecords.map(r => r.fields.Email);
    return theRecord;
  }
  return null;
}

function lookupAsset(assetTag) {
  assetTag = assetTag.trim().replace(/o/i, '0');
  let records = listRecords(InventoryEndpoint, ['Asset Tag', 'Make', 'Model', 'Serial', 'YOP'], filterByFormula = `{Asset Tag}="${assetTag}"`);
  if (records.length) { return records[0].fields; }
}

function testAsset() { console.log('Got asset:', lookupAsset('A0341')); }
function testLookupUser() { console.log('Got:', lookupStudentUser('chery.berroa@innovationcharter.org')); }
function testProcessedLookup() {
  let data = getProcessedData();
  let row = data.getRow('2_ABaOnud3YDkvOaL1IrQKS1gCwcO_kCdCSODFTGW_h09oGE8J6yEa1sk0GwQooihi-PMP2A8');
  console.log('Found row', row);
}
