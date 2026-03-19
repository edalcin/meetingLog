# Feature Specification: Add Notas Field and Text Editor to Meeting Form

**Feature Branch**: `005-add-notas-editor`
**Created**: 2026-03-19
**Status**: Draft
**Input**: User description: "Add notas column to reuniao table, migrate historical notes from CSV, and add text editor UI to meeting form (create, edit, view)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View meeting notes in existing records (Priority: P1)

A user opens a recorded meeting and can read the notes associated with that meeting. The notes display formatted text (bullet lists, headings) rendered from the stored plain-text format, making the meeting record a complete reference.

**Why this priority**: The historical data migration (from CSV) populates notes for past meetings. Without a way to view them, the migration has no value. This is the fastest-to-validate slice.

**Independent Test**: Open any migrated meeting record in the view modal — the notes field must be visible and display formatted text from the database.

**Acceptance Scenarios**:

1. **Given** a meeting record with notes exists in the database, **When** the user opens the meeting view modal, **Then** the notes are displayed with bullet points and headings visually formatted.
2. **Given** a meeting record with no notes, **When** the user opens the view modal, **Then** the notes section is present but shown as empty (no error or hidden section).

---

### User Story 2 - Edit notes on an existing meeting (Priority: P2)

A user opens a meeting record for editing and can modify the notes in a text editor. The editor accepts plain text with markdown-style formatting (bullet lists with `-`, headings with `#`) and saves the updated notes back to the database.

**Why this priority**: Editing capability is essential for correcting migrated data and keeping notes up to date.

**Independent Test**: Open an existing meeting for editing, modify the notes field, save the record, then re-open to confirm the updated text persists.

**Acceptance Scenarios**:

1. **Given** a meeting with existing notes is open for editing, **When** the user changes the notes text and saves, **Then** the updated notes are persisted in the database.
2. **Given** the edit form is open, **When** the user types bullet points (`- item`) or headings (`#### Title`), **Then** the editor provides a comfortable multi-line input experience.
3. **Given** the edit form is open, **When** the user clears the notes field and saves, **Then** the meeting record is saved with an empty/null notes value.

---

### User Story 3 - Add notes when creating a new meeting (Priority: P3)

A user filling in a new meeting form can enter notes in the same text editor. Notes are optional — a meeting can be saved without notes.

**Why this priority**: New meeting creation completes the full CRUD cycle. It is dependent on the editor and database column already working.

**Independent Test**: Create a new meeting record with notes text, save, then open the record in view mode to confirm notes appear.

**Acceptance Scenarios**:

1. **Given** the new meeting form is open, **When** the user fills in notes and saves, **Then** the new meeting record contains the notes in the database.
2. **Given** the new meeting form is open, **When** the user leaves the notes field empty and saves, **Then** the meeting record is saved without error.

---

### Edge Cases

- What happens when notes contain special characters (quotes, ampersands, HTML-like tags)?
- How does the display handle very long notes (hundreds of lines)?
- What happens if a CSV row's date does not match any meeting in the database?
- What happens if two CSV rows share the exact same datetime (true duplicate)? → Migration logs a warning and skips the second row.
- What happens when notes contain escaped double-quotes (e.g., `""plano B""` as found in the CSV source)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The `reuniao` table MUST have a `notas` column that stores plain text of unlimited length.
- **FR-002**: Historical notes MUST be migrated from the source CSV file into the `notas` column, matched by full datetime (`YYYY-MM-DD HH:MM:SS`) against `data_hora` in the `reuniao` table.
- **FR-003**: The migration script MUST be stored in `/docs/source/scripts/` and MUST NOT be committed to the remote repository.
- **FR-004**: The migration MUST skip CSV rows where no matching meeting date is found in the database, logging a warning for each skipped row.
- **FR-005**: The migration MUST handle CSV rows with empty notes by leaving the existing database value unchanged.
- **FR-006**: The meeting view (info modal) MUST display the `notas` field as rendered HTML: lines starting with `-` render as list items (`<li>`), lines starting with `####` render as headings (`<h4>`), and indented `-` lines render as nested lists.
- **FR-007**: The meeting edit form MUST include a multi-line text editor for the `notas` field, pre-populated with the current value, positioned at the bottom of the form after all existing card sections.
- **FR-008**: The meeting create form MUST include a multi-line text editor for the `notas` field (empty by default), positioned at the bottom of the form after all existing card sections.
- **FR-009**: The `notas` field MUST be optional in both create and edit forms — saving without notes MUST be permitted.
- **FR-010**: The backend API endpoints for creating and updating meetings MUST accept and persist the `notas` field.
- **FR-011**: The backend API endpoint for retrieving a meeting MUST return the `notas` field.

### Key Entities

- **Reuniao**: The existing meeting entity. Gains a new optional `notas` attribute (long text). One meeting has zero or one set of notes.
- **NotasSource**: The CSV file (`memoriaReunioes-Notas.csv`) containing `data` (datetime) and `notasMD` (plain text with markdown-style markers). Used for one-time historical data import only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All CSV rows with a matching meeting date have their notes successfully loaded into the database — 0 rows are silently lost.
- **SC-002**: Users can open any migrated meeting and read formatted notes without any additional steps.
- **SC-003**: Users can add, edit, or clear meeting notes in under 30 seconds from opening the form.
- **SC-004**: The notes field correctly saves and restores text with bullet points (`-`), indented sub-items, and headings (`####`), as present in the historical data.
- **SC-005**: The migration script is not present in the remote git repository (confirmed by absence in `git ls-files`).

## Clarifications

### Session 2026-03-19

- Q: Should the migration match CSV rows to DB meetings using full datetime or date only? → A: Full datetime (`YYYY-MM-DD HH:MM:SS`) — uniquely identifies each meeting.
- Q: How should notes be displayed in the meeting view modal? → A: Rendered HTML — `- item` becomes `<li>`, `#### Title` becomes `<h4>`, indented items become nested lists.
- Q: Where should the notes editor appear in the meeting form layout? → A: Bottom of the form, after all existing cards (pautas, projetos, participantes).

## Assumptions

- The CSV format is tab-separated (not comma) with two columns: `data` (datetime, format `YYYY-MM-DD HH:MM:SS`) and `notasMD` (plain text, possibly double-quote wrapped).
- Matching between CSV and database is by full datetime (`YYYY-MM-DD HH:MM:SS`), comparing the `data` column in the CSV against `data_hora` in the `reuniao` table.
- The text editor UI does not need a rich/WYSIWYG editor — a multi-line plain-text input is sufficient for authoring. The view mode renders the stored text as HTML, converting markdown-style markers (`-`, `####`, indented `-`) into visual HTML elements.
- The migration script will use the database credentials provided by the user and will be kept outside version control.
- The `/docs/source/scripts/` path will be excluded from git commits (`.gitignore` addition if needed).
