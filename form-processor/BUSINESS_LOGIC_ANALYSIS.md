# Business Logic Analysis: Chromebook Ticket System

## Overview

This document analyzes the current business logic in the form-processor to help plan the migration to an Airtable-first workflow with minimal processing in this Google Apps Script.

## Current Data Flow

### Input Sources

1. **Google Form Responses** - Raw ticket submissions
2. **Airtable Data Sources** (via API):
   - `StaffEndpoint` - Staff directory with emails, roles, asset assignments
   - `StudentEndpoint` - Student directory with emails, advisors, contact info
   - `InventoryEndpoint` - Asset inventory with tags, makes, models, serials
3. **Google Sheets Data**:
   - `StudentSchedules` sheet - Advisory and free block schedules

### Processing Pipeline

```
Form Response → Process Response → Enrich Data → Store → Notify
     ↓              ↓              ↓           ↓       ↓
Raw Fields → Standardize → Lookup People → Spreadsheet → Chat
```

## Business Logic Components

### 1. **Form Data Processing** (`getResponseMap`, `processResponse`)

**Location**: Core processing logic in `processResponse()` function

**What it does**:

- Extracts form field responses into structured map
- Handles multiple fields with same name (returns arrays)
- Adds email from `getRespondentEmail()` if available

**Keep/Move/Replace**:

- ✅ **KEEP** - This is basic data extraction, fine to keep in GAS
- Could be simplified to just prepare data for Airtable

### 2. **Email Normalization** (`fixEmail`)

**Location**: `fixEmail()` function

**What it does**:

- Adds @innovationcharter.org domain if missing
- Fixes domain if wrong (changes other domains to innovationcharter.org)
- Adds missing dots in First.Last format names
- Handles arrays of emails

**Business Rules**:

- Default domain: `@innovationcharter.org`
- Auto-fix pattern: `FirstnameLastname` → `Firstname.Lastname`

**Keep/Move/Replace**:

- ✅ **KEEP** - This is lightweight normalization, fine in GAS
- Could also be moved to Airtable automation if preferred

### 3. **Problem Classification** (`processProblem`)

**Location**: `processProblem()` function

**What it does**:

- Maps free-text problem descriptions to standardized keywords
- Keywords: `'broken','wet','printer','dead',"won't turn on",'internet',"won't load","charger","program or page isn't working","password"`

**Business Rules**:

- If text contains keyword → return keyword
- Otherwise → return original text
- Handles arrays by processing each item

**Keep/Move/Replace**:

- 🔄 We can do this better in our web app: we can remove this!

### 4. **Urgency Processing** (`processUrgency`)

**Location**: `processUrgency()` function

**What it does**:

- Maps urgency text to numeric codes
- "unusable" → 3 (High)
- "hard" → 2 (Medium)
- Other → 1 (Low)
- None → 0

**Keep/Move/Replace**:

- ✅ **REMOVE** - We don't need this. If we're going to add an "urgency" we can put it into the web app and let humans make these decisions.

### 5. **Description Assembly** (`processDescription`)

**Location**: `processDescription()` function

**What it does**:

- Combines multiple description fields into single text
- Fields: 'Problem Description', 'Damage Info', 'Incident Description'
- Prefixes incident with "Incident: "
- Joins with newlines

**Keep/Move/Replace**:

- ✅ **KEEP** - Simple text processing

### 6. **People Lookup & Enrichment**

**Location**: `lookupStudentUser()`, `lookupStaffUser()`, `lookupStudentScheduleInfo()`

**What it does**:

- **Student Lookup**: Uses email to find LASID, Name, YOG, Advisor, Contact emails, Asset tags
- **Staff Lookup**: Uses email to find Full Name, Role, School, Asset tags
- **Schedule Lookup**: Uses LASID to find Advisory and Free block info from Google Sheets
- **Advisor Email Lookup**: Finds advisor emails by matching Advisory name to Staff records

**Data Sources**:

- Airtable Student & Staff tables
- Google Sheets "StudentSchedules"

**Business Rules**:

- Normalizes asset tags from "Asset Tag" to "Signed Out Assets"
- Combines Contact1Email + Contact2Email arrays
- Looks up advisor emails by name matching

**Keep/Move/Replace**:

- 🔄 **COMPLEX** - This is the heaviest business logic
- ✅ **Student/Staff Lookup** could stay in GAS (it's just API calls)
- 🚨 **Schedule Lookup** from Google Sheets - should this move to Airtable?
- 🔄 **Advisor Email Lookup** - could be pre-computed in Airtable

### 7. **Grade/School Calculation** (`getSchool`)

**Location**: `getSchool()` function

**What it does**:

- Calculates current grade and school from Year of Graduation (YOG)
- Accounts for July+ graduation timing
- Maps grade ranges to school codes: HS (9+), MS (5-8), ? (other)
- Returns format: "HS (12th, '25)"

**Business Rules**:

- Senior YOG = current year + 1 if month >= July, else current year
- Grade = senior YOG - student YOG + 12

**Keep/Move/Replace**:

- 🔄 **CONSIDER MOVING** to Airtable automation
- This is pure calculation that could be a formula
- ✅ **KEEP for now** since it's self-contained

### 8. **Asset Lookup & Link Generation** (`lookupAsset`, `formatAssetLink`)

**Location**: `lookupAsset()`, `formatAssetLink()` functions

**What it does**:

- Normalizes asset tags (replaces 'o' with '0')
- Looks up asset info from Airtable Inventory
- Generates HTML links to cb.innovationcharter.org asset pages
- Skips linking for multi-word entries like "Personal Machine"

**Business Rules**:

- Asset tag normalization: 'o' → '0' (common typo)
- Link format: `https://cb.innovationcharter.org/asset/{assetTag}`

**Keep/Move/Replace**:

- ✅ **KEEP Asset Lookup** - just an API call
- 🔄 **Link Generation** - could move to web app or Airtable

### 9. **Chat Notification Logic** (`sendToChat`, `getEmailForRow`)

**Location**: `sendToChat()`, `getEmailForRow()` functions

**What it does**:

- Sends rich Google Chat cards for tickets with UrgentCode >= 1
- Builds complex message with user info, asset info, location info
- Generates multiple email links (user, user+advisor, user+advisor+family)
- Includes edit form link and spreadsheet management link
- Maps problems to notification images

**Business Rules**:

- Only notify for urgent tickets (UrgentCode >= 1)
- Priority mapping: 1=Low, 2=Medium, 3=High
- Multiple email options based on available contacts
- Link to current spreadsheet management

**Keep/Move/Replace**:

- 🚨 **MAJOR CHANGE NEEDED** - Currently links to spreadsheet
- 🔄 **Chat Logic** - Could move to web app webhook or Airtable automation
- ✅ **KEEP for Phase 1** but update links to point to web app

### 10. **Spreadsheet Integration** (`getProcessedData`, `processedData.pushRow`)

**Location**: Throughout `processResponse()` function

**What it does**:

- Checks if response already processed (prevents duplicates)
- Pushes enriched record to "Processed Responses" sheet
- Uses SHL.Table library for sheet operations

**Keep/Move/Replace**:

- 🚨 **PHASE OUT** - This is the main migration target
- Phase 1: Keep spreadsheet + add Airtable
- Phase 2: Remove spreadsheet, only use Airtable

## Data Dependencies

### External API Dependencies

- **Airtable API** (4 endpoints): Staff, Students, Inventory, Contacts
- **Google Chat Webhook**: For notifications

### Internal Data Dependencies

- **Google Sheets**: StudentSchedules sheet for advisory/free period lookup
- **Google Forms**: Form responses and edit URLs
- **Images**: GitHub-hosted icons for chat notifications

## Migration Recommendations

### Phase 1: Parallel Processing (Immediate)

```
Form → GAS Processing → Both Spreadsheet + Airtable Tickets
                    → Chat (keep current links)
```

**Changes needed**:

1. Add Airtable ticket creation to `processResponse()`
2. Map all current fields to Airtable schema
3. Handle Airtable API errors gracefully

### Phase 2: Web App Integration (After cb.innovationcharter.org ready)

```
Form → GAS Processing → Airtable Only
                    → Chat (update links to web app)
```

**Changes needed**:

1. Update `SPREADSHEET_URL` references to web app URLs
2. Update edit links and management links in chat
3. Remove spreadsheet processing

### Phase 3: Minimize GAS Processing (Optional future)

```
Form → Minimal GAS → Airtable
     → Web App Webhook → Chat
```

**Changes needed**:

1. Move heavy processing to Airtable automations
2. Move schedule lookup to Airtable
3. Move chat logic to web app

## Immediate TODO Updates

### High Priority (Phase 1)

- [ ] Create Airtable "Tickets" table with all current fields
- [ ] Add Airtable ticket creation in `processResponse()`
- [ ] Test parallel processing (spreadsheet + Airtable)
- [ ] Add error handling for Airtable failures
- [ ] Update data validation/dropdown copying for Airtable

### Medium Priority (Phase 2)

- [ ] Move StudentSchedules data to Airtable
- [ ] Update chat links to point to web app
- [ ] Remove spreadsheet processing
- [ ] Update form edit workflow

### Low Priority (Phase 3)

- [ ] Move problem classification to Airtable automation
- [ ] Move grade calculation to Airtable formula
- [ ] Move chat notifications to web app webhooks
- [ ] Simplify GAS to just form→Airtable passthrough

## Technical Notes

### Current Form Fields Processed

```javascript
let fields = [
  "What is the problem with your chromebook?",
  "Appointment Notes",
  "Computer Status",
  "Problem Description",
  "Incident Description",
  "Damage Info",
  "Location",
  "Name",
];
```

### Generated/Computed Fields

- `id` - Form response ID
- `timestamp` - Formatted timestamp
- `Grade` - Calculated from YOG
- `Problem` - Classified problem keyword
- `Description` - Combined description text
- `UrgentCode` - Numeric urgency
- `Edit` - Form edit URL
- Plus all enriched user/asset data

### Key Functions by Migration Phase

**Keep in GAS (All Phases)**:

- `getResponseMap()` - Basic form processing
- `fixEmail()` - Email normalization
- `onFormSubmit()` - Form trigger

**Phase 1 Changes**:

- `processResponse()` - Add Airtable ticket creation
- Keep all lookup functions

**Phase 2 Changes**:

- `sendToChat()` - Update links to web app
- Remove spreadsheet operations

**Phase 3 Changes**:

- Minimize to just form→Airtable handoff
- Move business logic to Airtable/web app
