# Feature Specification: Meeting Log Application

**Feature Branch**: `001-meeting-log-app`
**Created**: 2026-03-14
**Status**: Draft
**Input**: User description: "Meeting registration app with MariaDB, Docker on UNRAID, PWA support, PIN authentication"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - PIN Authentication (Priority: P1)

A user opens the app and is presented with a PIN entry screen. They enter their configured PIN and gain access to the application. Without a valid PIN, no content is accessible.

**Why this priority**: Security is foundational — all other features depend on authenticated access being functional first.

**Independent Test**: Can be tested by deploying the app with a PIN environment variable, navigating to the URL, entering the correct PIN, and verifying access is granted; entering a wrong PIN and verifying access is denied.

**Acceptance Scenarios**:

1. **Given** the app is loaded, **When** the user enters the correct PIN, **Then** access to the meeting list is granted and the PIN screen is dismissed.
2. **Given** the app is loaded, **When** the user enters an incorrect PIN, **Then** an error message is shown and access is denied.
3. **Given** the user has authenticated, **When** they navigate or refresh within the same browser session, **Then** they do not need to re-enter the PIN. Closing all browser tabs/windows ends the session and requires re-authentication.

---

### User Story 2 - List and Filter Meetings (Priority: P2)

An authenticated user views a table of all registered meetings. They can sort the table by date, type, participants, or project, and filter the list by any of these fields to find specific meetings quickly.

**Why this priority**: Viewing and searching existing data is the primary day-to-day use case for most users.

**Independent Test**: Can be tested with pre-migrated data by loading the meetings list, applying text filter on "projeto" field, and verifying only matching rows appear.

**Acceptance Scenarios**:

1. **Given** meetings exist in the database, **When** the user opens the meetings list, **Then** all meetings are displayed in a sortable table ordered by date descending.
2. **Given** the meetings list is displayed, **When** the user types in the search/filter input, **Then** the table updates in real time to show only matching rows.
3. **Given** the meetings list is displayed, **When** the user clicks a column header, **Then** the list is sorted by that column (ascending/descending toggle).

---

### User Story 3 - Register New Meeting (Priority: P3)

An authenticated user fills out a meeting registration form (date/time, type, participants, project) and saves it. The new meeting immediately appears in the meetings list.

**Why this priority**: Core write functionality; depends on the list view being operational to verify saved records.

**Independent Test**: Can be tested by filling the form with valid data, submitting, and verifying the record appears in the meetings list.

**Acceptance Scenarios**:

1. **Given** the user is on the new meeting form, **When** they fill all fields and submit, **Then** the meeting is saved and the user is returned to the updated meetings list.
2. **Given** the user submits an incomplete form, **When** a required field is missing, **Then** an inline validation error identifies the missing field and the record is not saved.
3. **Given** the user opens the new meeting form, **When** they cancel, **Then** no record is created and they return to the meetings list.

---

### User Story 4 - Edit Existing Meeting (Priority: P4)

An authenticated user selects a meeting from the list, edits its details, and saves the changes. The updated data reflects immediately in the list.

**Why this priority**: Data correction is needed but lower priority than read and create operations.

**Independent Test**: Can be tested by selecting an existing meeting, modifying the date field, saving, and verifying the updated date appears in the list.

**Acceptance Scenarios**:

1. **Given** a meeting exists, **When** the user clicks edit and modifies fields, **Then** changes are saved and visible in the list.
2. **Given** the user is editing, **When** they clear a required field and attempt to save, **Then** validation prevents saving and shows an error.

---

### User Story 5 - Data Migration from CSV (Priority: P1)

All existing records from `memoriaReunioes-Reuniao.csv` are imported into the MariaDB database on first setup, so historical data is immediately available without manual re-entry.

**Why this priority**: Without migrated historical data the application has no initial value; this must happen before the app is usable for day-to-day operations.

**Independent Test**: Can be tested by running the migration script and verifying the count of records in the database matches the CSV row count.

**Acceptance Scenarios**:

1. **Given** the CSV file is present, **When** the migration script runs, **Then** all CSV records are inserted into the database without data loss.
2. **Given** migration has already run, **When** the migration script runs again, **Then** it skips or upserts without creating duplicates.

---

### Edge Cases

- What happens when the database is unreachable at app startup? → A clear error message is displayed; the app does not crash silently.
- What happens when a participant list is very long (50+ names)? → The field accepts free text; display truncates with expand option.
- What happens when two meetings share the same date/time/project? → Both are recorded; no unique constraint blocks duplicate entries.
- What happens when the PIN environment variable is not set? → The app refuses to start and logs a configuration error.
- What happens when the CSV contains malformed rows during migration? → Malformed rows are skipped and logged; valid rows are still imported.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST require PIN authentication before granting access to any feature; PIN is configured via environment variable.
- **FR-002**: System MUST display all meetings in a paginated, sortable table with columns: date/time, type (Presencial/Remota), participants, project.
- **FR-003**: System MUST allow real-time text filtering of the meetings table across all columns.
- **FR-004**: System MUST provide a form to register a new meeting with fields: date, time, type (dropdown: Presencial/Remota), participants (free text), project (free text).
- **FR-005**: System MUST validate that date, type, and project fields are required before saving a meeting.
- **FR-006**: System MUST allow editing and saving changes to any existing meeting record.
- **FR-007**: System MUST include a data migration script that imports all records from the source CSV into MariaDB on initial setup.
- **FR-008**: System MUST be packaged as a minimal Docker image published to `ghcr.io/edalcin/`.
- **FR-009**: Docker image MUST accept the following environment variables: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `APP_PIN`, `APP_PORT` (default: 3000).
- **FR-010**: System MUST support Progressive Web App (PWA) installation (installable to home screen with app manifest and service worker registration); no offline data access is required.
- **FR-011**: A GitHub Actions workflow MUST automatically build and publish a new Docker image to GHCR on every push to `main`.
- **FR-012**: Installation instructions for UNRAID (via Docker → Add UI) MUST be provided in a Markdown file.
- **FR-013**: The user interface MUST be responsive and usable on mobile, tablet, and desktop screen sizes.

### Key Entities

- **Meeting (Reunião)**: Represents a single meeting event. Attributes: id, date (datetime), type (enum: Presencial/Remota), participants (text), project (text), created_at, updated_at.
- **User Session**: Represents an authenticated session. Validated by PIN match; no persistent user accounts. Session maintained client-side for the browser session duration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All historical records from the source CSV are available in the application immediately after initial deployment with no manual re-entry required.
- **SC-002**: Users can register a new meeting in under 60 seconds from opening the form to confirmation of save.
- **SC-003**: The meetings list filters results within 500ms of the user stopping typing (no page reload required).
- **SC-004**: The application is installable as a PWA (add to home screen) on both Android and iOS devices; no offline functionality is required.
- **SC-005**: The Docker image size does not exceed 150MB compressed.
- **SC-006**: A new Docker image is published to GHCR within 5 minutes of a commit being pushed to `main`.
- **SC-007**: Unauthorized access (wrong or missing PIN) is blocked 100% of the time across all pages/routes.
- **SC-008**: The application renders correctly and is fully usable on screens from 375px width (mobile) upward.

## Clarifications

### Session 2026-03-14

- Q: What is the scope of PWA offline functionality? → A: PWA install only — app is installable and adds to home screen; no offline data caching or offline entry is required.
- Q: How long does the PIN authentication session persist? → A: Browser session lifetime — PIN is required once per browser session; closing all tabs/browser requires re-entry on next visit.
- Q: What port does the container expose and is it configurable? → A: Port 3000 by default, overridable via `APP_PORT` environment variable.

## Assumptions

- The application has a single class of authenticated user (no role-based access control needed).
- The PIN is a simple static value stored in browser session storage (cleared on tab/window close); no persistent login across browser restarts.
- The CSV delimiter is semicolon (`;`) based on the source file format.
- Participants field is free text (comma-separated names) and does not link to a separate contacts entity.
- Project field is free text; no separate project management entity is required.
- Deletion of meeting records is not required in v1.
- The MariaDB instance is managed externally; the app only connects to it (no embedded database).
- The UNRAID server has internet access to pull images from GHCR.
- The GitHub repository is `edalcin/meetingLog` (or similar under the `edalcin` org/user on GitHub).
