let PROCESSED_SHEETNAME = 'Processed Responses'

function getProcessedData () {
let processedSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PROCESSED_SHEETNAME);
  if (!processedSheet) {
    throw `Expected to find a sheet named ${PROCESSED_SHEETNAME}`;
  }
  return SHL.Table(processedSheet.getDataRange(), "id");
}

function processUnprocessedResponses () {

  let attachedFormURL = SpreadsheetApp.getActiveSpreadsheet().getFormUrl()

  let attachedForm = FormApp.openByUrl(attachedFormURL);
  let processedData = getProcessedData();
  let unprocessedResponses = attachedForm.getResponses().filter(
    (r) => !processedData.getRow(r.getId())
  );
  let r = unprocessedResponses[0];
  
  //let email = r.getRespondentEmail();
  console.log('Unprocessed responses are: ',unprocessedResponses.length, unprocessedResponses);
  for (let r of unprocessedResponses) {
    processResponse(r, processedData);
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
  'Computer Status'	,
  'Problem Description',
  'Incident Description',
  'Damage Info',
  'Location',
  'Name'
]
function processUrgency (urgencyText) {
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

function processProblem (problemText) {
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
    'broken','wet','printer','dead',"won't turn on",'internet',
    "won't load","charger","program or page isn't working","password"
  ];
  for (let keyword of keywords) {
    if (problemText.includes(keyword)) {
      return keyword
    }
  }
  return problemText;
}

function processDescription (responseMap) {
  let mainDescription = responseMap['Problem Description'];
  let damageInfo = responseMap['Damage Info'];
  let incidentDescription = responseMap['Incident Description'];
  if (incidentDescription) {
    incidentDescription = 'Incident: '+incidentDescription;
  }
  let parts = [mainDescription,damageInfo,incidentDescription];
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

let schedData = null;

function getSchedData () {
  if (schedData) {
    return schedData;
  } else {
    sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('StudentSchedules');
    LASID = 0; ADV = 1; FREE = 2;
    let data = sheet.getDataRange().getValues();
    let headers = data[0];
    console.info('LASID header:',headers[0],'ADV:',headers[1],'Free:',headers[2]);
    schedData = {};
    for (let rn = 1; rn < data.length; rn++) {
      let row = data[rn];
      let key = row[LASID];
      let adv = row[ADV];
      let free = row[FREE];
      schedData[key] = {adv, free}
    }
  }
  return schedData;
}
function testGetSchedData () {
  let d = getSchedData();
  console.log('Got schedule data e.g.', d[2689]);
  console.log(schedData);
}

function lookupStudentScheduleInfo ({LASID}) {
  if (!LASID) {
    return {};
  } else {
    let scheduleLookup = getSchedData();
    let scheduleInfo = scheduleLookup[LASID];
    if (!scheduleInfo) {
      scheduleInfo = scheduleLookup[Number(LASID)];
    }
    return scheduleInfo || {};
  }
}

/**
 * Processes a form response.
 * @param {GoogleAppsScript.Forms.FormResponse} r - The form response to process.
 * @param {Object} [processedData] - A map/object containing already processed data.
 */
function processResponse (r, processedData=undefined) {

  if (!processedData) {
    processedData = getProcessedData();
  }
  if (processedData[r.getId()]) {
    console.warn('Already processed',r,processedData.getRow(r.getId()));
    return
  } else {
    console.log('process away!');
    let responseMap = getResponseMap(r, ['Email Address', 'Email', 'Asset Tag',...fields]);

    let rawEmail = responseMap['Email Address'][0];
    let formUser = responseMap['formUser'][0];
    if (responseMap['Email']) {
      rawEmail = responseMap['Email'][0]
    }
    let rawAsset = responseMap['Asset Tag'][0];
    let atStudentUser = lookupStudentUser(rawEmail);
    let atStudentScheduleInfo = atStudentUser ? lookupStudentScheduleInfo(atStudentUser) : {};
    let atUser = atStudentUser || {}
    if (!atStudentUser) {
      atUser = lookupStaffUser(rawEmail) || {};
    }
    let stamp = r.getTimestamp();
    let stampDate = new Date(stamp);
    let timestamp = stampDate.toLocaleDateString()+' '+stampDate.toLocaleTimeString();
    let editUrl = r.getEditResponseUrl();
    let atAsset = lookupAsset(rawAsset);
    let newRecord = {
      ...responseMap,
      id : r.getId(),
      timestamp,
      FormUser : formUser,
      FormEmail : rawEmail,
      FormAsset : rawAsset,    
      Description: processDescription(responseMap),
      Problem: processProblem(responseMap['What is the problem with your chromebook?']),
      ...atUser,
      ...atAsset,
      ...atStudentScheduleInfo,
      'Advisory':atStudentScheduleInfo?.adv,
      'Free Blocks':atStudentScheduleInfo?.free,
      Edit : editUrl,
      UrgentCode : processUrgency(responseMap['Computer Status']),
      Urgency : responseMap['Computer Status'] || 'All set'
    }
    newRecord.Grade = getSchool(newRecord.YOG);
    // Push to spreadsheet
    processedData.pushRow(newRecord);
    // Maybe chat?
    sendToChat(newRecord);
  }
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

let imageBase = 'https://github.com/thinkle-iacs/chromebook-ticket-system/blob/main/icons/'
let imageSuffix = '?raw=true'
let images = {
   'screen':'screen.png',
   'wet':'wet.png',
   "won't turn on":'no-on.png',
   'printer':'printer.png',
    'keys':'keyboard.png',
    "log-in":'log-in.png',
    "camera and/or microphone":'no-mic.png',
    'frame':'frame.png',
}

function formatAssetLink (assetTag) {
  if (Array.isArray(assetTag)) {
    assetTag = assetTag.join(' ');
  }
  if (assetTag.trim().includes(' ')) {
    return assetTag; // ignore e.g. "Personal Machine";
  } else {
    return `<a href="https://cb.innovationcharter.org/asset/${assetTag}">${assetTag}</a>`
  }
}

function getSchool(YOG) {
  if (!YOG) {
    return "";
  }
  YOG = Number(YOG); // Ensure YOG is a number
  let currentDate = new Date();
  let currentYear = currentDate.getFullYear();
  let currentMonth = currentDate.getMonth(); // 0 = January, 11 = December

  // If it's July or later, seniors are graduating NEXT year
  // Otherwise, they're graduating this year
  let seniorYOG = currentMonth >= 6 ? currentYear + 1 : currentYear;

  // Calculate grade level
  let grade = seniorYOG - YOG + 12;

  let school;
  if (grade >= 9) {
    school = 'HS';
  } else if (grade >= 5 && grade <= 8) {
    school = 'MS';
  } else {
    school = "?";
  }

  // Return school name with grade and YOG in parentheses
  return `${school} (${grade}th, '${YOG.toString().slice(2)})`;
}

function testGetSchool () {
  for (let YOG of ['2025','2030','2032','2027','2026']) {
    console.log(`${YOG} => ${getSchool(YOG)}`);
  }
}

function getEmailForRow (record) {
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

function sendToChat (record) { 
  if (record.UrgentCode >= 1) {
    let priorities = ['None','Low (Usable)','Medium (Semi-Usable)','High (Unusable)'];    
    let title = `New Chromebook Ticket - Priority ${priorities[record.UrgentCode]}`
    let user = fixEmail(record.FormEmail);
    let extraRows = [];
    if (record.FormEmail != record.FormUser) {
      user += ' (submitted by '+record.FormUser+')'
    }
    if (record.Name) {
      user += '\n' + record.Name
    }
    if (record.Grade) {
      extraRows.push(record.Grade);
    }    
    //['LASID','Name','YOG','Advisor','Email','Asset Tag','Contact1Email','Contact2Email'],
    if (record.Advisor) {
      user += ` (Advisor: ${record.Advisor})`;
    }
    if (record.Role) {
      user += ` (${record.School} ${record.Role})`
    }
    
    if (record['Asset Tag']) {
      let assetRow = `<b>Asset Tag</b>: ${formatAssetLink(record['Asset Tag'])} (<i>as reported by user</i>)`;
      if (record.Make || record.Model || record.Serial) { 
        assetRow += `\n<b>Inventory Info</b> ${record.Make||'?'} ${record.Model||'?'} (${record.Serial||'?'})`;
      }
      extraRows.push(assetRow)
    }
    if (record['Signed Out Assets']) {
      extraRows.push(`User has signed out: ${record['Signed Out Assets'].join(', ')}`)
    }
    if (record.Location || record['Appointment Notes'] || record.adv || record.free) {
      let findThemTexts = ['<b>Where to find them:</b>'];
      if (record.Location) {
        findThemTexts.push('<i>Currently in</i> '+record.Location.join(','));
      }
      if (record.adv) {
        findThemTexts.push('<i>Advisory: </i>' + record.adv)
      }
      if (record.free) {
        findThemTexts.push('<i>Study blocks:</i> '+record.free);
      }
      if (record['Appointment Notes']) {
        findThemTexts.push('<i>Notes from student: </i>'+record['Appointment Notes']);
      }      
      extraRows.push(findThemTexts.join('\n'));
    }
    extraRows.push(`<b>Problem:</b> ${record.Problem}\n<b>Description:</b> ${record.Description}`);   
    extraRows.push(getEmailForRow(record)); 
    extraRows.push(
      `<a href="${record.Edit}">Edit this response</a> (will push it onto the list again)`
    )
    extraRows.push(
      `Manage this ticket in <a href="${SPREADSHEET_URL}">the ticket spreadsheet.</a>`
    )
    let image = undefined;
    if (images[record.Problem]) {
      image = `${imageBase}${images[record.Problem]}${imageSuffix}`
      console.log('Image is:',image)
    }
    console.log('Sending chat',title,user,extraRows,image)
    sendCardMessageToGoogleChat(
      title,user,extraRows, image
    )
  }
}

function testFixEmail () {
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

function fixEmail (email) {
  if (Array.isArray(email)) {
    return email.map(fixEmail).join(',');
  }
  email = email.trim();
  if (!email.includes('@')) {
    email = email + '@innovationcharter.org'
  } else if (!email.includes('@innovationcharter.org')) {
    email = email.replace(/@[^@]*$/,'@innovationcharter.org');
  }
  let noDotMatcher = /^([A-Z][a-z]+)([A-Z][a-z]+)/
  // If the student left the dot out of First.Last, put it back in!
  if (noDotMatcher.test(email)) {
    email = email.replace(noDotMatcher, '$1.$2');
  }
  return email;
}

function lookupStaffUser (email) {
  email = fixEmail(email);

let records = listRecords(StaffEndpoint, ['Full Name','Role','School (Short)','Email','Asset Tag'],filterByFormula=`LOWER(Email)=LOWER("${email}")`);
  console.log('record:',records);
  if (records && records.length) {
    let theRecord = records[0].fields;
    if (records.length > 1) {
      console.warn('Found multiple records for email',email,records);
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

function lookupStudentUser (email) {
  if (!email) {return null}
  email = fixEmail(email);
  let records = listRecords(StudentEndpoint, ['LASID','Name','YOG','Advisor','Email','Asset Tag','Contact1Email','Contact2Email'],filterByFormula=`LOWER(Email)=LOWER("${email}")`);
  console.log('record:',records);
  if (records && records.length) {
    let theRecord = records[0].fields;
    if (records.length > 1) {
      console.warn('Found multiple records for email',email,records);
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
    let advisorRecords = listRecords(StaffEndpoint, ['Email'],filterByFormula=`LOWER(Advisory)=LOWER("${theRecord.Advisor}")`);
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
  // Get the FormResponse object from the event
  let r = e.response;
  // Process the new response
  processResponse(r);
}

function createOnFormSubmitTrigger() {
  let form = FormApp.openByUrl(SpreadsheetApp.getActiveSpreadsheet().getFormUrl());
  ScriptApp.newTrigger('onFormSubmit')
    .forForm(form)
    .onFormSubmit()
    .create();
}

function lookupAsset (assetTag) {
  assetTag = assetTag.trim().replace(/o/i,'0');
  let records = listRecords(
    InventoryEndpoint, ['Asset Tag','Make','Model','Serial','YOP'], filterByFormula=`{Asset Tag}="${assetTag}"`
  );
  if (records.length) {
    return records[0].fields;
  }
}

function testAsset () {
  console.log('Got asset:',lookupAsset('A0341'));
}

function testLookupUser () {
  console.log('Got:',lookupStudentUser('chery.berroa@innovationcharter.org'));
  //console.log('Got:',lookupStaffUser('thinkle@innovationcharter.org'));
}

function testProcessedLookup () {
  let data=  getProcessedData();
  let row = data.getRow('2_ABaOnud3YDkvOaL1IrQKS1gCwcO_kCdCSODFTGW_h09oGE8J6yEa1sk0GwQooihi-PMP2A8');
  console.log('Found row',row);
  console.log(data);

}
