let PROCESSED_SHEETNAME = 'Processed Responses'

function getProcessedData() {
  let processedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PROCESSED_SHEETNAME);
  if (!processedSheet) {
    throw `Expected to find a sheet named ${PROCESSED_SHEETNAME}`;
  }
  return SHL.Table(processedSheet.getDataRange(), "id");
}

function processUnprocessedResponses() {

  let attachedFormURL = SpreadsheetApp.getActiveSpreadsheet().getFormUrl()

  let attachedForm = FormApp.openByUrl(attachedFormURL);
  let processedData = getProcessedData();
  let unprocessedResponses = attachedForm.getResponses().filter(
    (r) => !processedData.getRow(r.getId())
  );
  let r = unprocessedResponses[0];
  console.log('Unprocessed responses are: ', unprocessedResponses.length, unprocessedResponses);
  for (let r of unprocessedResponses) {
    processResponseSheetsLegacy(r, processedData);
  }
}

/**
 * Return a map from item names to an array of responses from items with that name.
 * @param {GoogleAppsScript.Forms.FormResponse} response - The form response to process.
 * @param {string[]} [fields] - A list of field titles.
 * @returns {Object.<string, string[]>} A mapping of field names to an array of responses.
 *
 * Example return:
 * {
 *    'Name': ['Thomas'],
 *    'Asset Tag': ['A12039'],
 * }
 * Arrays are used rather than flat values because a form may have multiple fields with the same name.
 */
function getResponseMap(response, fields) {
  const itemResponses = response.getItemResponses();
  const responseMap = {};
  let userEmail = response.getRespondentEmail();
  if (userEmail) {
    responseMap['Email Address'] = [userEmail];
    responseMap['formUser'] = [userEmail];
  }

  itemResponses.forEach(itemResponse => {
    const title = itemResponse.getItem().getTitle();
    itemResponse.get
    const response = itemResponse.getResponse();
    // Check if the title is in the specified fields list, if provided
    if (!fields || fields.includes(title)) {
      // If the title is already in the map, append the response to the existing array
      if (responseMap[title]) {
        responseMap[title].push(response);
      } else {
        // Otherwise, create a new array with this response
        responseMap[title] = [response];
      }
    }
  });

  return responseMap;
}

let fields = [
  'What is the problem with your chromebook?',
  'Appointment Notes',
  'Computer Status',
  'Problem Description',
  'Incident Description',
  'Damage Info',
  'Location',
  'Name'
]
function processUrgency(urgencyText) {
  if (Array.isArray(urgencyText)) {
    urgencyText = urgencyText[0];
  }
  if (!urgencyText) {
    return 0;
  }
  if (urgencyText.toLowerCase().includes('unusable')) {
    return 3;
  } else if (urgencyText.toLowerCase().includes('hard')) {
    return 2;
  } else {
    return 1;
  }
}

function processProblem(problemText) {
  if (Array.isArray(problemText)) {
    let text = '';
    for (let p of problemText) {
      let problemPart = processProblem(p);
      if (problemPart) {
        text += problemPart;
      }
      return text;
    }
  }
  let keywords = [
    'broken', 'wet', 'printer', 'dead', "won't turn on", 'internet',
    "won't load", "charger", "program or page isn't working", "password"
  ];
  for (let keyword of keywords) {
    if (problemText.includes(keyword)) {
      return keyword
    }
  }
  return problemText;
}

function processDescription(responseMap) {
  let mainDescription = responseMap['Problem Description'];
  let damageInfo = responseMap['Damage Info'];
  let incidentDescription = responseMap['Incident Description'];
  if (incidentDescription) {
    incidentDescription = 'Incident: ' + incidentDescription;
  }
  let parts = [mainDescription, damageInfo, incidentDescription];
  let descriptions = [];
  for (let p of parts) {
    if (Array.isArray(p)) {
      for (let item of p) {
        if (item) {
          descriptions.push(item);
        }
      }
    } else if (p) {
      descriptions.push(p);
    }
  }
  return descriptions.join('\n');
}

/**
 * Processes a form response.
 * @param {GoogleAppsScript.Forms.FormResponse} r - The form response to process.
 * @param {Object} [processedData] - A map/object containing already processed data.
 */
function processResponseSheetsLegacy(r, processedData = undefined) {

  if (!processedData) {
    processedData = getProcessedData();
  }
  if (processedData[r.getId()]) {
    console.warn('Already processed', r, processedData.getRow(r.getId()));
    return
  } else {
    console.log('process away!');
    let responseMap = getResponseMap(r, ['Email Address', 'Email', 'Asset Tag', ...fields]);

    let rawEmail = responseMap['Email Address'][0];
    let formUser = responseMap['formUser'][0];
    if (responseMap['Email']) {
      rawEmail = responseMap['Email'][0]
    }
    let rawName = responseMap['Name'][0];
    let rawAsset = responseMap['Asset Tag'][0];
    let atStudentUser = lookupStudentUser(rawEmail);
    let atStudentScheduleInfo = atStudentUser ? lookupStudentScheduleInfo(atStudentUser) : {};
    let atUser = atStudentUser || {}
    if (!atStudentUser) {
      atUser = lookupStaffUser(rawEmail) || {};
    }
    let stamp = r.getTimestamp();
    let stampDate = new Date(stamp);
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
    }
    newRecord.Grade = getSchool(newRecord.YOG);
    console.log('Pushing record to sheet:', newRecord);
    processedData.pushRow(newRecord);
    sendToChat(newRecord);
  }
}

// Restored helper (previously adjacent to image constants) for asset links
function formatAssetLink(assetTag) {
  if (Array.isArray(assetTag)) {
    assetTag = assetTag.join(' ');
  }
  if (assetTag.trim().includes(' ')) {
    return assetTag; // ignore e.g. "Personal Machine";
  } else {
    return `<a href="https://cb.innovationcharter.org/asset/${assetTag}">${assetTag}</a>`
  }
}

// Restored helper for computing school / grade from YOG
function getSchool(YOG) {
  if (!YOG) { return ""; }
  YOG = Number(YOG);
  let currentDate = new Date();
  let currentYear = currentDate.getFullYear();
  let currentMonth = currentDate.getMonth();
  let seniorYOG = currentMonth >= 6 ? currentYear + 1 : currentYear;
  let grade = seniorYOG - YOG + 12;
  let school;
  if (grade >= 9) {
    school = 'HS';
  } else if (grade >= 5 && grade <= 8) {
    school = 'MS';
  } else {
    school = "?";
  }
  return `${school} (${grade}th, '${YOG.toString().slice(2)})`;
}

function fillDropdownInColumnCFromRow2() {
  // Get the active sheet
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Processed Responses");

  // Get the last row number with data
  const lastRow = sheet.getLastRow();

  // Define the validation source range (row 2, column C)
  const validationSourceRange = sheet.getRange(2, 3); // Row 2, Column C

  // Get the data validation rule from the source range
  const validationRule = validationSourceRange.getDataValidation();

  if (validationRule && lastRow > 2) {  // Ensure we have a validation rule and rows to fill
    // Define the range from row 3 to the last row in column C
    const targetRange = sheet.getRange(3, 3, lastRow - 2, 1); // From row 3 to last row

    // Apply the validation rule to the entire target range
    targetRange.setDataValidation(validationRule);
  } else {
    Logger.log("No validation rule found in the source or no rows to fill.");
  }
}

function sendToChat(record) {
  if (record.UrgentCode >= 1) {
    let priorities = ['None', 'Low (Usable)', 'Medium (Semi-Usable)', 'High (Unusable)'];
    let title = `New Chromebook Ticket - Priority ${priorities[record.UrgentCode]}`
    let user = fixEmail(record.FormEmail);
    let extraRows = [];
    if (record.FormEmail != record.SubmittedBy) {
      user += ' (submitted by ' + record.SubmittedBy + ')'
    }
    if (record.FormName) {
      extraRows.push('Name: ' + record.FormName);
    }
    if (record.Grade) {
      extraRows.push(record.Grade);
    }
    if (record.Advisor) {
      user += ` (Advisor: ${record.Advisor})`;
    }
    if (record.Role) {
      user += ` (${record.School} ${record.Role})`
    }

    if (record['Asset Tag']) {
      let assetRow = `<b>Asset Tag</b>: ${formatAssetLink(record['Asset Tag'])} (<i>as reported by user</i>)`;
      if (record.Make || record.Model || record.Serial) {
        assetRow += `\n<b>Inventory Info</b> ${record.Make || '?'} ${record.Model || '?'} (${record.Serial || '?'})`;
      }
      extraRows.push(assetRow)
    }
    if (record['Signed Out Assets']) {
      extraRows.push(`User has signed out: ${record['Signed Out Assets'].join(', ')}`)
    }
    if (record.Location || record['Appointment Notes'] || record.adv || record.free) {
      let findThemTexts = ['<b>Where to find them:</b>'];
      if (record.Location) {
        findThemTexts.push('<i>Currently in</i> ' + record.Location.join(','));
      }
      if (record.adv) {
        findThemTexts.push('<i>Advisory: </i>' + record.adv)
      }
      if (record.free) {
        findThemTexts.push('<i>Study blocks:</i> ' + record.free);
      }
      if (record['Appointment Notes']) {
        findThemTexts.push('<i>Notes from student: </i>' + record['Appointment Notes']);
      }
      extraRows.push(findThemTexts.join('\n'));
    }
    extraRows.push(`<b>Problem:</b> ${record.Problem}\n<b>Description:</b> ${record.Description}`);
    extraRows.push(getEmailForRow(record));
    if (record.FormName != record.Name) {
      extraRows.push('Name in form: ' + record.FormName)
      extraRows.push('vs. Name via email: ' + record.Name);
    }
    extraRows.push(
      `<a href="${record.Edit}">Edit this response</a> (will push it onto the list again)`
    )
    extraRows.push(
      `Manage this ticket in <a href="${SPREADSHEET_URL}">the ticket spreadsheet.</a>`
    )
    let image = undefined;
    if (typeof images !== 'undefined' && images[record.Problem]) {
      image = `${imageBase}${images[record.Problem]}${imageSuffix}`
      console.log('Image is:', image)
    }
    console.log('Sending chat', title, user, extraRows, image)
    sendCardMessageToGoogleChat(
      title, user, extraRows, image
    )
  }
}

function testGetSchool() {
  for (let YOG of ['2025', '2030', '2032', '2027', '2026']) {
    console.log(`${YOG} => ${getSchool(YOG)}`);
  }
}

function getEmailForRow(record) {
  let links = '';
  let email = fixEmail(record.FormEmail);
  if (email) {
    links += `<a href="mailto:${email}">Email user</a>`;
  }
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

function testFixEmail() {
  for (let e of [
    ' thinkle@innovationcharter.org',
    'thinkle@gmail.com',
    'Thomas.Hinkle',
    'thinkle',
    'Thomas.Hinkle@innovation',
    'ThomasHinkle@innovationcharter.org'
  ]) {
    console.log(`Fix Email: "${e}" => "${fixEmail(e)}"`);
  }
}

function fixEmail(email) {
  if (Array.isArray(email)) {
    return email.map(fixEmail).join(',');
  }
  email = email.trim();
  if (!email.includes('@')) {
    email = email + '@innovationcharter.org'
  } else if (!email.includes('@innovationcharter.org')) {
    email = email.replace(/@[^@]*$/, '@innovationcharter.org');
  }
  let noDotMatcher = /^([A-Z][a-z]+)([A-Z][a-z]+)/
  // If the student left the dot out of First.Last, put it back in!
  if (noDotMatcher.test(email)) {
    email = email.replace(noDotMatcher, '$1.$2');
  }
  return email;
}

function lookupStaffUser(email) {
  email = fixEmail(email);

  let records = listRecords(StaffEndpoint, ['Full Name', 'Role', 'School (Short)', 'Email', 'Asset Tag'], filterByFormula = `LOWER(Email)=LOWER("${email}")`);
  console.log('record:', records);
  if (records && records.length) {
    let theRecord = records[0].fields;
    if (records.length > 1) {
      console.warn('Found multiple records for email', email, records);
      console.warn('ignoring records past the first one');
    }
    theRecord.Name = theRecord['Full Name'];
    theRecord.School = theRecord['School (Short)'];
    if (theRecord['Asset Tag']) {
      theRecord['Signed Out Assets'] = theRecord['Asset Tag'];
      delete theRecord['Asset Tag'];
    }
    return theRecord;
  } else {
    console.warn('No record found!')
    return null;
  }
}

function lookupStudentUser(email) {
  if (!email) { return null }
  email = fixEmail(email);
  let records = listRecords(StudentEndpoint, ['LASID', 'Name', 'YOG', 'Advisor', 'Email', 'Asset Tag', 'Contact1Email', 'Contact2Email'], filterByFormula = `LOWER(Email)=LOWER("${email}")`);
  console.log('record:', records);
  if (records && records.length) {
    let theRecord = records[0].fields;
    if (records.length > 1) {
      console.warn('Found multiple records for email', email, records);
      console.warn('ignoring records past the first one');
    }
    if (theRecord['Asset Tag']) {
      theRecord['Signed Out Assets'] = theRecord['Asset Tag'];
      delete theRecord['Asset Tag'];
    }
    /* Either Contact1Email or Contact2Email could be null or [] */
    theRecord.Contacts = [];
    if (theRecord.Contact1Email) {
      theRecord.Contacts = [...theRecord.Contact1Email];
    }
    if (theRecord.Contact2Email) {
      theRecord.Contacts = [...theRecord.Contacts, ...theRecord.Contact2Email];
    }
    // Now let's look up the advisor emails...
    let advisorRecords = listRecords(StaffEndpoint, ['Email'], filterByFormula = `LOWER(Advisory)=LOWER("${theRecord.Advisor}")`);
    let advisorEmails = advisorRecords.map(
      (record) => record.fields.Email
    );
    theRecord.AdvisorEmails = advisorEmails;
    return theRecord;
  } else {
    console.warn('No record found!')
    return null;
  }
}
function onFormSubmit(e) {
  let r = e.response;
  // New Airtable-first processing
  processResponse(r);
  /* Legacy fallback:
  processResponseSheetsLegacy(r);
  */
}

/**
 * New Airtable-focused ticket processing (no lookups, minimal fields).
 * Creates or updates a ticket in Airtable and sends a chat notification.
 */
function processResponse(r) {
  if (!r) { console.warn('processResponse called with null response'); return; }
  let responseMap = getResponseMap(r, ['Email Address', 'Email', 'Asset Tag', ...fields]);
  let formID = r.getId();
  let formUser = responseMap.formUser ? responseMap.formUser[0] : null;
  let rawEmail = responseMap['Email Address'] && responseMap['Email Address'][0];
  if (responseMap['Email']) { rawEmail = responseMap['Email'][0]; }
  let formName = responseMap['Name'] ? responseMap['Name'][0] : '';
  let formAsset = responseMap['Asset Tag'] ? responseMap['Asset Tag'][0] : '';
  const description = buildUserDescription(responseMap);
  if (shouldSkipTicket(responseMap)) {
    console.log('Skipping ticket per rules (FormID)', formID);
    // Still mark as processed so we do not repeatedly reconsider it.
    markProcessedInSheet(r, responseMap, description, 0, null);
    return;
  }
  const priority = computePriority(responseMap['Computer Status'], description);
  const ticketFields = {
    FormID: formID,
    'Ticket Status': 'New',
    'Form Name': formName,
    FormEmail: rawEmail,
    SubmittedBy: formUser || rawEmail,
    FormAsset: formAsset,
    'User Description': description,
    Priority: priority
  };
  let rec = upsertTicket(ticketFields);
  let number = rec.fields['Number'];
  // Mark in legacy sheet for recovery tracking
  markProcessedInSheet(r, responseMap, description, priority, number);
  sendTicketChat({
    number,
    priority,
    formName,
    rawEmail,
    submittedBy: ticketFields.SubmittedBy,
    formAsset,
    description
  });
}

// New lightweight chat notification for Airtable-first flow (with image)
function sendTicketChat(opts) {
  const { number, priority, formName, rawEmail, submittedBy, formAsset, description } = opts;
  const title = `New Ticket #${number} (P${priority})`;
  let user = fixEmail(rawEmail || submittedBy || '');
  if (rawEmail && submittedBy && rawEmail !== submittedBy) {
    user += ` (submitted by ${submittedBy})`;
  }
  const rows = [];
  if (formName) rows.push('Name: ' + formName);
  if (formAsset) rows.push('Asset: ' + formAsset);
  rows.push('<b>Description:</b> ' + (description || '(none)'));
  // Primary app link (replace placeholder path if different)
  const appUrl = buildTicketAppUrl(number);
  rows.push(`<a href="${appUrl}">Open in Ticket App</a>`);
  /* // Optional legacy sheet link (only if global defined)
  if (typeof SPREADSHEET_URL !== 'undefined') {
    rows.push(`<a href="${SPREADSHEET_URL}">Legacy Sheet</a>`);
  } */
  let firstLine = (description || '').split(/\n/)[0];
  let image = pickTicketImageForNewFlow(firstLine, description);
  sendCardMessageToGoogleChat(title, user, rows, image);
}

function buildTicketAppUrl(number) {
  // Adjust the path pattern if your production app differs
  const BASE = (typeof TICKET_APP_BASE !== 'undefined') ? TICKET_APP_BASE : 'https://cb.innovationcharter.org';
  return `${BASE}/ticket/${number}`;
}

/**
 * Mark a response as processed in the legacy sheet, for recovery and tracking.
 * @param {GoogleAppsScript.Forms.FormResponse} r - The form response.
 * @param {Object} responseMap - The response map.
 * @param {string} description - The user description.
 * @param {number} priority - The computed priority.
 * @param {string} number - The ticket number.
 */
function markProcessedInSheet(r, responseMap, description, priority, number) {
  try {
    const processedData = getProcessedData();
    const formID = r.getId();
    if (processedData.getRow(formID)) {
      // Already marked
      return;
    }
    const stampDate = new Date(r.getTimestamp());
    const timestamp = stampDate.toLocaleDateString() + ' ' + stampDate.toLocaleTimeString();
    const rawEmail = (responseMap['Email Address'] && responseMap['Email Address'][0]) || '';
    const formName = (responseMap['Name'] && responseMap['Name'][0]) || '';
    const formAsset = (responseMap['Asset Tag'] && responseMap['Asset Tag'][0]) || '';
    processedData.pushRow({
      id: formID,
      timestamp,
      FormEmail: rawEmail,
      FormName: formName,
      FormAsset: formAsset,
      'User Description': description,
      Priority: priority,
      TicketNumber: number,
      ProcessedVia: 'airtable-v1'
    });
  } catch (err) {
    console.warn('Could not mark processed in sheet (non-fatal)', err);
  }
}


/** Test: process the last form response with new Airtable flow */
function testProcessLastFormResponse() {
  let form = FormApp.openByUrl(SpreadsheetApp.getActiveSpreadsheet().getFormUrl());
  let responses = form.getResponses();
  if (!responses.length) { console.log('No responses'); return; }
  processResponse(responses[responses.length - 1]);
}

/** Test: process a random form response with new Airtable flow */
function testProcessRandomFormResponse() {
  let form = FormApp.openByUrl(SpreadsheetApp.getActiveSpreadsheet().getFormUrl());
  let responses = form.getResponses();
  if (!responses.length) { console.log('No responses'); return; }
  let r = responses[Math.floor(Math.random() * responses.length)];
  processResponse(r);
}
