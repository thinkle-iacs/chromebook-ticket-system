# TODO

This project is transitioning from spreadsheet-based ticket tracking to an Airtable-powered workflow. The initial form processing will remain here, while ticket management will move to our [cb.innovationcharter.org](https://cb.innovationcharter.org) project (separate repo).

## Migration Steps

- [ ] **Migrate Ticket Tracking**

  - Move ticket data from spreadsheets to Airtable.
  - Ensure Airtable schema matches current ticket fields.

- [ ] **Phase 1: Airtable Integration**

  - Post processed form responses directly to Airtable tickets.
  - Validate that all required fields are mapped correctly.
  - Add error handling for Airtable API failures.

- [ ] **Phase 2: Update Card Links**

  - Once cb.innovationcharter.org has working ticket views:
    - Update "card" links to point to the new web app instead of the spreadsheet.
    - Test links for accuracy and permissions.

- [ ] **Phase 3: Deprecate Spreadsheet Processing**
  - Remove spreadsheet processing steps from this repository.
  - Archive or document legacy spreadsheet workflows for reference.

## Additional Tasks

- [ ] Update documentation to reflect new workflow.
- [ ] Notify stakeholders of migration timeline and changes.
- [ ] Monitor for issues post-migration and address feedback.

---

\*Last updated: 7/17/25
