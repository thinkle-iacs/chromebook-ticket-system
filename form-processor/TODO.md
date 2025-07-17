# TODO

This project is transitioning from spreadsheet-based ticket tracking to an Airtable-powered workflow. The initial form processing will remain here, while ticket management will move to our [cb.innovationcharter.org](https://cb.innovationcharter.org) project (separate repo).

See [BUSINESS_LOGIC_ANALYSIS.md](./BUSINESS_LOGIC_ANALYSIS.md) for detailed analysis of current business logic and migration recommendations.

## Migration Steps

### Phase 1: Parallel Processing (CURRENT PRIORITY)

- [ ] **Create Airtable Tickets Table**

  - [ ] Design schema matching current spreadsheet fields (see analysis doc)
  - [ ] Include all computed fields: `Grade`, `Problem`, `UrgentCode`, etc.
  - [ ] Set up proper field types (text, number, select, etc.)
  - [ ] Test basic record creation via API

- [ ] **Parallel Data Storage**

  - [ ] Modify `processResponse()` to write to both spreadsheet AND Airtable
  - [ ] Add new Airtable endpoint for tickets in `Secrets.gs.js`
  - [ ] Create `createTicketRecord()` function using existing `updateRecords()`
  - [ ] Add error handling - if Airtable fails, still process to spreadsheet
  - [ ] Test with real form submissions

- [ ] **Data Validation Migration**
  - [ ] Update `fillDropdownInColumnCFromRow2()` to work with Airtable
  - [ ] Consider moving status dropdowns to Airtable select fields
  - [ ] Ensure data consistency between spreadsheet and Airtable

### Phase 2: Web App Integration (AFTER cb.innovationcharter.org ready)

- [ ] **Update Chat Links**

  - [ ] Replace `SPREADSHEET_URL` with web app ticket URLs in `sendToChat()`
  - [ ] Update "Edit this response" workflow to integrate with web app
  - [ ] Update "Manage this ticket" links to point to web app
  - [ ] Test all notification links

- [ ] **Remove Spreadsheet Dependency**
  - [ ] Remove `getProcessedData()` and spreadsheet operations from `processResponse()`
  - [ ] Remove `fillDropdownInColumnCFromRow2()` function
  - [ ] Archive current spreadsheet data
  - [ ] Update documentation

### Phase 3: Streamline Processing (FUTURE - OPTIONAL)

- [ ] **Move Schedule Data to Airtable**

  - [ ] Migrate "StudentSchedules" sheet data to Airtable Students table
  - [ ] Update `lookupStudentScheduleInfo()` to use Airtable instead of Sheets
  - [ ] Remove Google Sheets dependency entirely

- [ ] **Consider Moving Heavy Logic**
  - [ ] Move grade calculation (`getSchool()`) to Airtable formula
  - [ ] Move problem classification to Airtable automation
  - [ ] Move chat notifications to web app webhooks
  - [ ] Evaluate keeping only basic form→Airtable passthrough in GAS

## Technical Implementation Notes

### Current Field Mapping (for Airtable schema)

```
Form Fields → Processed Fields:
- Form Response ID → id
- Email Address → FormEmail (normalized via fixEmail())
- Name → FormName
- Asset Tag → FormAsset
- Computer Status → Urgency, UrgentCode (0-3)
- Problem Description + Damage Info + Incident → Description (combined)
- What is the problem? → Problem (classified to keywords)

Enriched Fields (from lookups):
- LASID, YOG, Advisor → from Student lookup
- Advisory, Free Blocks → from Schedule lookup
- Full Name, Role, School → from Staff lookup
- Make, Model, Serial, YOP → from Asset lookup
- Grade → calculated from YOG
- Edit → form edit URL
- timestamp → formatted submission time
```

### Key Functions to Modify

- `processResponse()` - Add Airtable ticket creation
- `sendToChat()` - Update links (Phase 2)
- `lookupStudentScheduleInfo()` - Switch to Airtable (Phase 3)

## Additional Tasks

- [ ] Update documentation to reflect new workflow.
- [ ] Notify stakeholders of migration timeline and changes.
- [ ] Monitor for issues post-migration and address feedback.
- [ ] Set up monitoring/logging for Airtable API failures.

---

\*Last updated: 7/17/25
