/**
 * Ticket database helper functions for Airtable Tickets table.
 * Provides an upsert (create or update) operation based on FormID.
 *
 * Assumptions:
 *  - Tickets table has a "FormID" text field (unique per Google Form response)
 *  - Tickets table has an auto-number or formula field "Number" used for UI links
 *  - Global constants: TicketEndpoint, AirTableKey, and helper listRecords / updateRecords
 */

/**
 * Upsert a ticket by FormID. If a ticket with the same FormID exists, it is patched.
 * Otherwise, a new ticket is created.
 * @param {Object} ticketFields - Key/value pairs matching Airtable field names.
 * @returns {Object} The Airtable record object returned (id + fields)
 */
function upsertTicket(ticketFields) {
  if (!ticketFields || !ticketFields.FormID) {
    throw new Error('upsertTicket requires ticketFields with a FormID');
  }
  const formID = ticketFields.FormID;
  // Look for existing record with same FormID
  let existing = [];
  try {
    existing = listRecords(
      TicketEndpoint,
      ['FormID', 'Number'],
      `{FormID}="${formID}"`
    );
  } catch (err) {
    console.error('Error listing records for upsertTicket', err);
    throw err;
  }
  // Patch existing
  if (existing.length > 0) {
    const recID = existing[0].id; // Airtable record id
    console.log('Updating existing ticket with FormID', formID, 'recordId', recID);
    const resp = updateRecords(
      TicketEndpoint,
      [{ id: recID, fields: ticketFields }],
      'patch'
    );
    return resp.records[0];
  }
  // Create new
  console.log('Creating new ticket for FormID', formID);
  const created = updateRecords(
    TicketEndpoint,
    [{ fields: ticketFields }],
    'post'
  );
  return created.records[0];
}

/**
 * Convenience wrapper for creating (not updating) a ticket.
 * @param {Object} ticketFields
 * @returns {Object} record
 */
function createTicket(ticketFields) {
  if (!ticketFields || !ticketFields.FormID) {
    throw new Error('createTicket requires ticketFields with a FormID');
  }
  console.log('Creating ticket (no upsert) for FormID', ticketFields.FormID);
  const created = updateRecords(
    TicketEndpoint,
    [{ fields: ticketFields }],
    'post'
  );
  return created.records[0];
}

/**
 * Build a combined description from raw form pieces (mirrors old processDescription logic)
 * @param {Object} responseMap
 * @returns {string}
 */
function buildUserDescription(responseMap) {
  const parts = [];
  const primary = responseMap['What is the problem with your chromebook?'];
  if (primary) {
    parts.push(Array.isArray(primary) ? primary.join('\n') : primary);
  }
  const pd = responseMap['Problem Description'];
  if (pd) {
    parts.push('Problem Description:\n' + (Array.isArray(pd) ? pd.join('\n') : pd));
  }
  const di = responseMap['Damage Info'];
  if (di) {
    parts.push('Damage Info:\n' + (Array.isArray(di) ? di.join('\n') : di));
  }
  const inc = responseMap['Incident Description'];
  if (inc) {
    parts.push('Incident:\n' + (Array.isArray(inc) ? inc.join('\n') : inc));
  }
  const appt = responseMap['Appointment Notes'];
  if (appt) {
    parts.push('Appointment Notes:\n' + (Array.isArray(appt) ? appt.join('\n') : appt));
  }
  // Append form-entered Name (so it's preserved even if email is malformed)
  const nameArr = responseMap['Name'];
  if (nameArr && nameArr.length && nameArr[0]) {
    parts.push(`Form Name:\n${nameArr[0]}`);
  }

  return parts.join('\n\n');
}

/**
 * Compute a priority (1-5) from the raw Computer Status / description.
 * Simple initial logic; can be refined later.
 * @param {string|string[]} computerStatusRaw
 * @param {string} description
 * @returns {number}
 */
function computePriority(computerStatusRaw, description) {
  let status = computerStatusRaw;
  if (Array.isArray(status)) { status = status[0]; }
  status = (status || '').toLowerCase();
  const desc = (description || '').toLowerCase();
  // Skip statuses handled elsewhere; this just maps urgency tiers.
  if (status.includes('unusable')) return 4; // high
  if (status.includes('hard')) return 3; // medium
  if (status.includes('usable')) return 2; // low
  // Specific keyword escalations (future: wet / broken screen etc.)
  if (desc.includes('wet')) return 5; // top priority example
  return 1; // default minimal priority
}

/**
 * Determine if we should suppress (skip) creating a ticket.
 * Rules:
 *  - If Computer Status indicates user is all set (contains 'all set')
 *  - If description indicates purely a lost charger (contains 'lost' AND 'charger')
 * @param {Object} responseMap
 * @returns {boolean}
 */
function shouldSkipTicket(responseMap) {
  let status = responseMap['Computer Status'];
  if (Array.isArray(status)) status = status[0];
  status = (status || '').toLowerCase();
  if (status.includes('all set')) {
    return true;
  }
  const primary = responseMap['What is the problem with your chromebook?'];
  let primaryText = Array.isArray(primary) ? primary.join(' ') : (primary || '');
  primaryText = primaryText.toLowerCase();
  if (primaryText.includes('charger') && primaryText.includes('lost')) {
    return true;
  }
  return false;
}

/**
 * Test helper: creates or updates a sample ticket and logs the Number.
 */
function testUpsertTicket() {
  const fakeResponseMap = {
    'What is the problem with your chromebook?': ['Screen is cracked but still works'],
    'Problem Description': ['Lines across the display, getting worse each day'],
    'Computer Status': ['I can use the computer, but it\'s hard to do basic tasks.'],
    'Damage Info': ['Corner impact, hinge OK'],
    'Incident Description': ['Dropped from desk yesterday'],
    'Appointment Notes': ['Student free after lunch'],
    'Name': ['Test Student'],
    'Asset Tag': ['A0123'],
    'Email Address': ['test.student@innovationcharter.org'],
    'formUser': ['test.student@innovationcharter.org']
  };
  const description = buildUserDescription(fakeResponseMap);
  const priority = computePriority(fakeResponseMap['Computer Status'], description);
  const ticketFields = {
    FormID: 'TEST_FORM_ID_123',
    'Ticket Status': 'New',
    'Form Name': fakeResponseMap['Name'][0],
    FormEmail: fakeResponseMap['Email Address'][0],
    SubmittedBy: fakeResponseMap['formUser'][0],
    FormAsset: fakeResponseMap['Asset Tag'][0],
    'User Description': description,
    Priority: priority
  };
  if (shouldSkipTicket(fakeResponseMap)) {
    console.log('Skipping ticket creation per rules');
    return;
  }
  const rec = upsertTicket(ticketFields);
  const ticketNumber = rec.fields['Number'];
  console.log('Upserted ticket. Record ID:', rec.id, 'Number:', ticketNumber, 'Fields:', rec.fields);
}
