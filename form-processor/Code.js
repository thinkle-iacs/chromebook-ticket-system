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
    let responseMap = getResponseMap(r, ['Email Address', 'Email', 'Asset Tag']);
    let rawEmail = responseMap['Email Address'][0];
    let formUser = responseMap['formUser'][0];
    if (responseMap['Email']) {
      rawEmail = responseMap['Email'][0]
    }
    let rawAsset = responseMap['Asset Tag'][0];
    let atStudentUser = lookupStudentUser(rawEmail);
    let atUser = atStudentUser || {}
    if (!atStudentUser) {
      atUser = lookupStaffUser(rawEmail) || {};
    }
    let stamp = r.getTimestamp();
    let stampDate = new Date(stamp);
    let timestamp = stampDate.toLocaleDateString()+' '+stampDate.toLocaleTimeString();

    let atAsset = lookupAsset(rawAsset);
    let newRecord = {
      id : r.getId(),
      timestamp,
      FormUser : formUser,
      FormEmail : rawEmail,
      FormAsset : rawAsset,      
      ...atUser,
      ...atAsset,
      
    }
    processedData.pushRow(newRecord);
  }
}


function lookupStaffUser (email) {
  email = email.trim();
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
  email = email.trim();
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
    theRecord.Contacts = [...theRecord.Contact1Email,...theRecord.Contact2Email];
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
  assetTag = assetTag.trim();
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
