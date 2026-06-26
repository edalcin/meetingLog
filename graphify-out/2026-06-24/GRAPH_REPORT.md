# Graph Report - D:\git\meetingLog  (2026-06-24)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 551 nodes · 968 edges · 53 communities (46 shown, 7 thin omitted)
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 213 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0652ce04`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_HTTP Response Handling|HTTP Response Handling]]
- [[_COMMUNITY_Core Data Models|Core Data Models]]
- [[_COMMUNITY_Meeting Database Operations|Meeting Database Operations]]
- [[_COMMUNITY_Settings and HTML Sanitization|Settings and HTML Sanitization]]
- [[_COMMUNITY_Server Core Infrastructure|Server Core Infrastructure]]
- [[_COMMUNITY_Meeting Form Logic|Meeting Form Logic]]
- [[_COMMUNITY_Frontend Dependencies|Frontend Dependencies]]
- [[_COMMUNITY_Meetings Management UI|Meetings Management UI]]
- [[_COMMUNITY_Session and Store Management|Session and Store Management]]
- [[_COMMUNITY_Login and Throttling Middleware|Login and Throttling Middleware]]
- [[_COMMUNITY_Participant Database Operations|Participant Database Operations]]
- [[_COMMUNITY_Frontend Routing and Components|Frontend Routing and Components]]
- [[_COMMUNITY_Local File Storage|Local File Storage]]
- [[_COMMUNITY_Dashboard Data Processing|Dashboard Data Processing]]
- [[_COMMUNITY_Maintenance and Backup UI|Maintenance and Backup UI]]
- [[_COMMUNITY_Rich Text Editor|Rich Text Editor]]
- [[_COMMUNITY_Participants Management UI|Participants Management UI]]
- [[_COMMUNITY_File Database Operations|File Database Operations]]
- [[_COMMUNITY_Institution Database Operations|Institution Database Operations]]
- [[_COMMUNITY_CSRF Protection Middleware|CSRF Protection Middleware]]
- [[_COMMUNITY_Frontend API Client|Frontend API Client]]
- [[_COMMUNITY_Share Link Management|Share Link Management]]
- [[_COMMUNITY_Application Entry Point|Application Entry Point]]
- [[_COMMUNITY_Dashboard Visualization UI|Dashboard Visualization UI]]
- [[_COMMUNITY_Entity Replacement UI|Entity Replacement UI]]
- [[_COMMUNITY_Health Check Handler|Health Check Handler]]
- [[_COMMUNITY_Security Headers Middleware|Security Headers Middleware]]
- [[_COMMUNITY_Meeting Link Handlers|Meeting Link Handlers]]
- [[_COMMUNITY_Project Link Handlers|Project Link Handlers]]
- [[_COMMUNITY_Database Schema Initialization|Database Schema Initialization]]
- [[_COMMUNITY_Storage Backend Interface|Storage Backend Interface]]
- [[_COMMUNITY_Docker Entrypoint Script|Docker Entrypoint Script]]
- [[_COMMUNITY_Deployment Documentation|Deployment Documentation]]
- [[_COMMUNITY_Thumbnail and Icon Generation|Thumbnail and Icon Generation]]
- [[_COMMUNITY_Service Worker Logic|Service Worker Logic]]
- [[_COMMUNITY_Application Branding|Application Branding]]
- [[_COMMUNITY_Project Repository Metadata|Project Repository Metadata]]

## God Nodes (most connected - your core abstractions)
1. `writeJSON()` - 39 edges
2. `writeError()` - 35 edges
3. `handleStoreErr()` - 30 edges
4. `./lib/components/MeetingsTab.svelte` - 29 edges
5. `parseID()` - 21 edges
6. `./RichEditor.svelte` - 20 edges
7. `Open()` - 17 edges
8. `./lib/components/ParticipantsTab.svelte` - 16 edges
9. `./lib/components/MaintenanceTab.svelte` - 16 edges
10. `../api.js` - 13 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `Open()`  [INFERRED]
  cmd/meetinglog/main.go → internal/store/open.go
- `ensureCSRFCookie()` --calls--> `NewCSRFToken()`  [INFERRED]
  internal/server/middleware_csrf.go → internal/security/csrf.go
- `backfillDeltaToHTML()` --calls--> `SanitizeEditorHTML()`  [INFERRED]
  internal/store/open.go → internal/security/sanitize.go
- `New()` --calls--> `NewThrottle()`  [INFERRED]
  internal/server/server.go → internal/server/middleware_throttle.go
- `New()` --calls--> `NewLocal()`  [INFERRED]
  internal/server/server.go → internal/storage/local.go

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Data Persistence Layer** — internal_store_open, internal_store_schema, internal_store_settings, internal_sessions_store [EXTRACTED 0.90]
- **PWA Implementation** — frontend_sw, frontend_app, claudemd_project [EXTRACTED 0.90]

## Communities (53 total, 7 thin omitted)

### Community 0 - "HTTP Response Handling"
Cohesion: 0.09
Nodes (30): HandlerFunc, Server, HandlerFunc, Server, HandlerFunc, Server, HandlerFunc, Server (+22 more)

### Community 1 - "Core Data Models"
Cohesion: 0.06
Nodes (42): Link, Participant, ParticipantSummary, Project, ProjectLink, MaintenanceMeeting, MeetingSummary, DashboardData (+34 more)

### Community 2 - "Meeting Database Operations"
Cohesion: 0.12
Nodes (36): DB, Link, Rows, Tx, DB, MaintenanceAffected, ParticipantSummary, Project (+28 more)

### Community 3 - "Settings and HTML Sanitization"
Cohesion: 0.10
Nodes (26): HandlerFunc, Server, DB, DB, T, SanitizeEditorHTML(), backfillDeltaToHTML(), Open() (+18 more)

### Community 4 - "Server Core Infrastructure"
Cohesion: 0.09
Nodes (25): Config, FS, Handler, Context, Handler, Request, ResponseWriter, Store (+17 more)

### Community 5 - "Meeting Form Logic"
Cohesion: 0.10
Nodes (13): addPauta(), autosave(), currentSig(), draftSig(), filteredProjects, handleClose(), handleKeydownPauta(), handleOverlayClick() (+5 more)

### Community 6 - "Frontend Dependencies"
Cohesion: 0.09
Nodes (21): dependencies, chart.js, @tiptap/core, @tiptap/extension-link, @tiptap/extension-placeholder, @tiptap/starter-kit, devDependencies, autoprefixer (+13 more)

### Community 7 - "Meetings Management UI"
Cohesion: 0.13
Nodes (13): ./lib/components/MeetingsTab.svelte, addParticipant(), addProject(), async(), deleteMeeting(), filteredProjects, load(), loadMore() (+5 more)

### Community 8 - "Session and Store Management"
Cohesion: 0.12
Nodes (13): Duration, Image, DB, RWMutex, Time, Reader, Session, New() (+5 more)

### Community 9 - "Login and Throttling Middleware"
Cohesion: 0.18
Nodes (10): HandlerFunc, Server, Request, ResponseWriter, Time, Mutex, ipState, NewThrottle() (+2 more)

### Community 10 - "Participant Database Operations"
Cohesion: 0.23
Nodes (17): DB, MaintenanceAffected, Participant, Rows, DB, T, CreateParticipant(), DeleteParticipant() (+9 more)

### Community 11 - "Frontend Routing and Components"
Cohesion: 0.26
Nodes (10): ./lib/components/InstitutionsTab.svelte, ./lib/components/LoginPage.svelte, ./lib/components/MeetingView.svelte, ./ParticipantInfoModal.svelte, ./ProjectInfoModal.svelte, ./lib/components/ProjectsTab.svelte, ./lib/components/SharedView.svelte, ../api.js (+2 more)

### Community 12 - "Local File Storage"
Cohesion: 0.20
Nodes (7): Context, Reader, ReadCloser, ReadSeekCloser, SafeAttachmentPath(), NewLocal(), LocalBackend

### Community 13 - "Dashboard Data Processing"
Cohesion: 0.24
Nodes (13): DashboardData, DashboardOptions, DB, Month, coalesceStrSlice(), dashWhere(), filterDescription(), GetDashboardData() (+5 more)

### Community 14 - "Maintenance and Backup UI"
Cohesion: 0.15
Nodes (10): ./lib/components/MaintenanceTab.svelte, autosaveSeconds, backupError, backupLoading, restoreError, restoreFile, restoreLoading, settingsError (+2 more)

### Community 15 - "Rich Text Editor"
Cohesion: 0.15
Nodes (11): ./RichEditor.svelte, isBullet, isH1, isH2, isH3, isItalic, isOrdered, @tiptap/core (+3 more)

### Community 16 - "Participants Management UI"
Cohesion: 0.21
Nodes (6): ./lib/components/ParticipantsTab.svelte, createInstitution(), deleteParticipant(), load(), loadInstitutions(), saveParticipant()

### Community 17 - "File Database Operations"
Cohesion: 0.36
Nodes (10): File, DB, CreateFile(), DeleteFile(), GetFile(), GetFileForContent(), GetFileForThumbnail(), GetMeetingBaseFilename() (+2 more)

### Community 18 - "Institution Database Operations"
Cohesion: 0.44
Nodes (9): Institution, DB, Rows, CreateInstitution(), DeleteInstitution(), GetInstitution(), ListInstitutions(), scanInstitution() (+1 more)

### Community 19 - "CSRF Protection Middleware"
Cohesion: 0.28
Nodes (7): Handler, Request, ResponseWriter, ConstantTimeEqual(), NewCSRFToken(), CSRF(), ensureCSRFCookie()

### Community 20 - "Frontend API Client"
Cohesion: 0.28
Nodes (4): api, getCsrfToken(), request(), authenticated

### Community 21 - "Share Link Management"
Cohesion: 0.54
Nodes (7): DB, ShareLink, CreateShareLink(), GetShareLinkByID(), GetShareLinkByToken(), ListShareLinks(), RevokeShareLink()

### Community 22 - "Application Entry Point"
Cohesion: 0.33
Nodes (6): Config, Assets, Server, Session Store, doHealthCheck(), main()

### Community 23 - "Dashboard Visualization UI"
Cohesion: 0.40
Nodes (3): ./lib/components/DashboardTab.svelte, loadDashboard(), updateCharts()

### Community 24 - "Entity Replacement UI"
Cohesion: 0.40
Nodes (3): ./ReplaceEntitySection.svelte, createAndSelectEntity(), selectTo()

### Community 25 - "Health Check Handler"
Cohesion: 0.33
Nodes (4): DB, Request, ResponseWriter, healthHandler

### Community 26 - "Security Headers Middleware"
Cohesion: 0.60
Nodes (4): Handler, FileContentCSP(), PublicShareCSP(), SecurityHeaders()

### Community 27 - "Meeting Link Handlers"
Cohesion: 0.67
Nodes (3): Link, parseLinks(), linkInput

### Community 28 - "Project Link Handlers"
Cohesion: 0.67
Nodes (3): ProjectLink, parseProjectLinks(), projectLinkInput

### Community 29 - "Database Schema Initialization"
Cohesion: 0.67
Nodes (3): Types, Store Open, Schema SQL

## Knowledge Gaps
- **125 isolated node(s):** `docker-entrypoint.sh script`, `name`, `version`, `private`, `type` (+120 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Open()` connect `Settings and HTML Sanitization` to `HTTP Response Handling`, `Session and Store Management`, `Participant Database Operations`, `Local File Storage`, `Application Entry Point`?**
  _High betweenness centrality (0.363) - this node is a cross-community bridge._
- **Why does `main()` connect `Application Entry Point` to `Settings and HTML Sanitization`?**
  _High betweenness centrality (0.287) - this node is a cross-community bridge._
- **Are the 36 inferred relationships involving `writeJSON()` (e.g. with `.handleCreateInstitution()` and `.handleCreateMeeting()`) actually correct?**
  _`writeJSON()` has 36 INFERRED edges - model-reasoned connections that need verification._
- **Are the 30 inferred relationships involving `writeError()` (e.g. with `.handleBackup()` and `.handleCreateInstitution()`) actually correct?**
  _`writeError()` has 30 INFERRED edges - model-reasoned connections that need verification._
- **Are the 27 inferred relationships involving `handleStoreErr()` (e.g. with `.handleCreateInstitution()` and `.handleCreateMeeting()`) actually correct?**
  _`handleStoreErr()` has 27 INFERRED edges - model-reasoned connections that need verification._
- **Are the 17 inferred relationships involving `parseID()` (e.g. with `.handleDeleteFile()` and `.handleDeleteInstitution()`) actually correct?**
  _`parseID()` has 17 INFERRED edges - model-reasoned connections that need verification._
- **What connects `docker-entrypoint.sh script`, `name`, `version` to the rest of the system?**
  _125 weakly-connected nodes found - possible documentation gaps or missing edges._