# LandslideGuard AI - build checklist

Status as of 2026-10-13. "Verified" means it was run and observed working on this machine (Windows 11,
Python 3.11.8, Node 22.18), not only written.

## Completed

### Phase 1 - Structure and frontend shell
- [x] Monorepo layout: `backend/` (FastAPI) and `frontend/` (React + Vite + Tailwind)
- [x] Responsive layout with header navigation, mobile menu and a disclaimer footer.
      *Verified:* screenshots at 1440 px and 1280 px, and at 390 px with DevTools device emulation. No horizontal overflow on Dashboard, Map, Incidents, Assess, Report, Methodology or Admin.
- [x] Pages are code-split. *Verified:* `npm run build` produces no chunk-size warnings.

### Phase 2 - Dashboard, charts, map
- [x] Summary tiles, level distribution, average risk by state, rainfall vs risk scatter, top-risk table, active alerts. Each chart has a table view. *Verified* in the browser.
- [x] Leaflet + OpenStreetMap map with level-coloured markers, popups, state and level filters, report markers, legend. *Verified:* tiles and markers render (46 markers re-checked after the nationwide update).
- [x] Location detail page with factor breakdown and assessment history. *Verified.*

### Phase 3 - Backend REST API
- [x] FastAPI app, SQLite via SQLAlchemy, startup seeding, OpenAPI docs at `/docs`. *Verified.*
- [x] Endpoints for meta, dashboard, locations, risk, alerts, reports, geocoding and admin (see README §9). *Verified* by tests and by live HTTP calls through the Vite proxy.

### Phase 4 - Risk service and ML pipeline
- [x] Transparent heuristic index (susceptibility × trigger) with per-factor breakdown and a methodology endpoint. *Verified* by 18 unit tests: bounds, monotonicity, thresholds, breakdown consistency.
- [x] Reproducible training pipeline (`python -m ml.train`): validation, stratified split, CV model selection, held-out metrics with baselines, permutation importance, model card with dataset hash and versions. *Verified:*
  - tests recompute the reported ROC-AUC from the saved model;
  - identical results for the same seed;
  - rejection of invalid datasets.
- [x] Synthetic data is labelled as synthetic everywhere: model card, API, UI. Real-CSV mode is supported. *Verified* by a test.
- [x] Live weather via Open-Meteo, with a labelled demo fallback. *Verified:* a real refresh of all 46 locations on 2026-10-11 returned 200 OK, no warnings and `data_source=open-meteo`. Fallback verified with a mocked HTTP 503.

### Phase 5 - Citizen reporting (original, Northeast only; superseded by Phase 9)
- [x] Report form, photo upload with EXIF stripping, validation. *Verified* (re-verified nationwide in Phase 9).

### Phase 6 - Alerts, report management, admin
- [x] Automatic system alerts for High / Very High levels. They update on change and resolve automatically. *Verified:*
  - unit test;
  - live: the 3 demo alerts resolved automatically after the switch to live data.
- [x] Alerts from demo data are titled `[DEMO]` and say they are not real warnings. *Verified.*
- [x] Admin sign-in using stdlib PBKDF2 and HMAC tokens. *Verified:* wrong password rejected; forged token rejected.
- [x] Admin report workflow: list, verify, resolve, reject, notes, delete with media removal. *Verified* by tests, and in the browser (sign-in, then verify report #6).
- [x] Admin alert management (issue, resolve, reactivate) and "refresh assessments now". *Verified* by tests and the live API.

### Phase 7 - Frontend ↔ backend
- [x] Vite dev proxy for `/api`. The public `/uploads` folder has been removed. *Verified.*
- [x] Optional single-process hosting: FastAPI serves `frontend/dist` with SPA fallback, and missing assets return 404. *Verified* by a test against the current build.

### Phase 8 - Config, sample data, tests, docs
- [x] `backend/.env.example` (now including the reporting and geocoding settings) and `frontend/.env.example`.
- [x] Sample data: 46 locations across all 8 states, with terrain marked as demo estimates, and 6 `[DEMO]` reports (2 outside the Northeast) for fresh installs.
- [x] Backend: **172 tests passing** (`python -m pytest`, run 2026-10-13 after the UI redesign).
- [x] Frontend: **58 unit tests passing** (`npm test`, run 2026-10-13 after the UI redesign); `npm run build` succeeds with no warnings.
- [x] README updated: setup, upgrade/rollback, configuration, nationwide reporting, API, limitations, troubleshooting.

### Phase 9 - Nationwide incident reporting (2026-10-12/13)
- [x] **Reports from anywhere in India.** The Northeast-only restriction was replaced by an India bounding-box check, plus an optional official boundary file. *Verified:*
  - tests accept 16 places in different states/UTs (Kerala, Ladakh, Andaman, Lakshadweep, Gujarat, J&K and more);
  - 7 API submissions from different states succeed;
  - London, Karachi, Dubai, Singapore, 0,0, NaN and out-of-range values are rejected;
  - the boundary-file check works with a synthetic test polygon.
- [x] **Incident types:** landslide, debris flow, rockfall, ground/slope cracks, soil movement, land subsidence, flood, flash flood, seepage, blocked road, other. *Verified* by tests.
- [x] **Incident time** (`observed_at`): no future times, at most 1 year old. IST offsets are converted to UTC (this bug was found and fixed while testing). *Verified* by tests.
- [x] **Location source** stored as `gps` / `map` / `manual`, with GPS accuracy kept only for GPS. Older records are `unknown`. *Verified* by API tests, unit tests and the browser.
- [x] **"Use my location" in the browser.** *Verified* in headless Edge with emulated geolocation:
  - an allowed fix fills the exact coordinates and shows "From your device's GPS (accuracy ±18 m)";
  - denied permission shows guidance and leaves the coordinates empty.

  Timeout, unavailable position, unsupported browser and insecure page are verified by unit tests.
  **Not verified on a physical phone with real GPS.**
- [x] **Map selection** (click or drag the pin) across India. *Verified:* a real mouse click in the browser switches the source to "Selected on the map" and removes the GPS accuracy circle.
- [x] **Manual entry:** typed coordinates plus state (36 states/UTs), district, address and landmark. *Verified* in the browser: typed coordinates are marked "Entered manually", and a point outside India is caught before submitting.
- [x] **Reverse geocoding**, optional and off by default. *Verified:*
  - one live Nominatim request returned Himachal Pradesh / Shimla / India;
  - the browser form auto-filled state and district, and the user could override them;
  - HTTP errors, bad responses, "not found" and caching are tested with mocks.
- [x] **Full browser submission**, Kochi, Kerala, with a photo: report #6 was stored with source `manual`, state/district, severity, photo metadata (800×600) and 0 EXIF tags. *Verified.*
- [x] **Media privacy.** *Verified* by tests and on the live server:
  - photos are public only after verification;
  - admins use signed, expiring links (forged or expired links return 403);
  - videos (MP4/MOV/WebM/3GP, checked by file signature, size-limited) are admin-only.
- [x] **Duplicate handling:**
  - an idempotency key returns the original report (200, `duplicate`);
  - an identical resubmission within 10 minutes also returns the original;
  - a re-used photo is flagged to admins;
  - an invalid file on a resubmission is still rejected;
  - stored files are cleaned up after a failure;
  - there is a per-IP rate limit (429).

  *Verified* by tests.
- [x] **Incidents map** (`/incidents`) with state, district, type, severity, date and status filters, plus an admin all-status view. *Verified* in the browser:
  - the pending report was hidden publicly;
  - after admin verification it appeared under Kerala + Flood;
  - the popup shows its labels and photo.
- [x] **Risk at a reported location:** a labelled model estimate near monitored Northeast towns; "Risk assessment unavailable" everywhere else. *Verified* by tests and in the browser (Shimla, Kochi).
- [x] **Labels** keep citizen reports, verified incidents, model estimates and official warnings distinct. Relayed official warnings require a named source and an http(s) link. *Verified* by tests and in the browser.
- [x] **Database migration** with automatic backup. *Verified:*
  - tests against the original v1 schema;
  - a copy of your real database (the backup is byte-identical to the original);
  - **your live database**: migrated on 2026-10-12, all 5 existing reports preserved, backup at `backend\landslideguard.db.backup-20261012-194640`.
- [x] **Reaching a reported location** (added 2026-10-13). Each admin report card has:
  - **Get directions** (Google Maps from the admin's current position, opens in a new tab or the Maps app on phones);
  - **Show on incident map** (opens `/incidents?report=ID` in admin view, zoomed to the report with its popup open);
  - **Copy coordinates**;
  - **OpenStreetMap**.

  Admin-view map popups also have "Get directions". Public popups deliberately do not, so the app does not direct people towards hazards. *Verified:* 3 unit tests (link format), and in the browser for report #2 (directions link to `25.18,93.03`; map opened in admin view with the unverified report's popup).
- [x] **Northeast monitoring unchanged.** *Verified* in the browser: dashboard, risk map (46 markers), location page, assess page and alerts.

### Phase 10 - UI redesign (2026-10-13)
All items below were checked in headless Edge at 1440 px, 1280 px, 820 px (tablet) and 390 px (phone): no horizontal overflow and no console errors. The browser checks were scripted runs in this session.

- [x] **Design system:** white surfaces, forest-green accent, navy text, soft shadows, rounded cards. Implemented as tokens in `index.css` and shared components in `ui.jsx`: buttons, inputs, cards, status and kind badges, tooltips, skeleton loaders, empty states, error messages with retry, drawer, step indicator. Icons share one consistent stroke set.
- [x] **Navigation:**
  - white sticky header, a "Report an Incident" button and a profile menu (sign in, or avatar → Admin console / Reports awaiting review / Sign out);
  - mobile menu, a fuller footer, and a shared sign-in state across all pages;
  - *Verified:* every header link opens a working page, unknown routes show a 404 with working links, and sign-out works from both the menu and the mobile menu.
- [x] **Home page (`/`):**
  - illustrated hill and landslide hero (inline SVG, no external image), "LandslideGuard AI", "Report. Monitor. Stay Safer.";
  - "Report an Incident" (→ `/report`) and "Explore Incident Map" (→ `/incidents`);
  - live figures from the API: 7 reports, 3 verified, 0 alerts, 46 towns at test time;
  - three feature cards linking to real pages, "how it works", the four information labels, and the latest verified incidents from the API.
- [x] **Dashboard (moved to `/dashboard`):** two clearly separated sections.
  - **Citizen reports – all India:**
    - summary cards: total reports, verified incidents, active alerts, critical locations;
    - incident-type chart and 30-day report trend, both with table views;
    - recent-reports table with status badges (public: verified/resolved only; admin: all statuses);
    - demo reports are counted and labelled.
  - **Risk monitoring – Northeast India:** labelled as model estimates.
  - *Verified:* the card values equal the API values, all 4+ charts render, and the public table shows only verified/resolved reports.
- [x] **Incident map:**
  - text search (state, district, landmark, text, `#ID`) and filters for state, district, type, severity, date and status (collapsible on mobile);
  - a place search box, shown only when address lookup is configured, so it is never a dead control;
  - clicking a marker or a list item opens a details panel (side panel on desktop, bottom sheet on mobile);
  - deep links via `?report=ID`; admin view with "Get directions".
  - *Verified:* search "darjeeling" → 1 result and 1 marker; the Kerala filter works; a real marker click opens the panel; the panel links to the report page.
- [x] **Report wizard:** 4 steps (details → location → photo/video → review & submit), per-step validation, drag-and-drop media with previews, a review step with edit links, and a confirmation screen with the reference number. The existing GPS, map and manual location handling, address lookup, risk context, duplicate-safe submission IDs and network-error retry are all kept. *Verified:*
  - empty steps are blocked with messages;
  - an emulated GPS fix in Darjeeling showed "±25 m";
  - a denied permission left the location empty, and a map click then set the source to "Selected on the map";
  - the photo preview and the review contents were correct;
  - the submission succeeded (report #8), and "Track this report" showed the status only.
- [x] **Report details page (`/reports/:id`):**
  - ID, status, type, location, times, description, media, mini-map, "Open on incident map";
  - verification history: public shows "by an administrator", admin shows usernames;
  - unpublished reports show only their status and timeline.
  - *Verified* for #6 (public), #8 (pending, then verified) and a missing ID (404 state).
- [x] **Verification history (backend):**
  - new `report_events` table (migration 3, with backup) logging submission, status changes, location corrections and note updates;
  - `GET /api/reports/{id}` (public-safe) and `GET /api/admin/reports/{id}` (full).
  - *Verified:* 9 new backend tests, plus a migration test on a copy of your database and then on your live database. All 7 reports were kept; the backup is `backend\landslideguard.db.backup-20261012-205107`.
- [x] **Admin console:**
  - sidebar (tabs on mobile) with a pending count;
  - reports table with status filters showing counts, search, state and type filters (card list on mobile);
  - review panel: media, details, directions/map/copy, location correction, internal notes, Verify & publish / Mark resolved / Reject / Back to unverified, delete with an inline confirmation, and the full history.
  - *Verified* in the browser: the note was saved and the report verified, the history shows "by admin", Esc closes the panel, and the mobile panel offers Google Maps directions.
- [x] **Labels and honesty:**
  - citizen report, verified incident, model estimate and official alert each have a distinct badge;
  - "A photo alone never verifies a report" appears in the form, the panels and the home page;
  - risk values appear only as labelled model estimates.

## Pending / not verified
- [ ] The home hero uses an SVG illustration. A real photograph needs an image you have the rights to.
- [ ] Verification history before 2026-10-13 is incomplete: older status changes were not recorded, and the UI says so.
- [ ] The admin reports table loads up to 2,000 reports and filters them in the browser. A larger deployment needs server-side paging.
- [ ] Place search on the incident map requires `GEOCODER_PROVIDER=nominatim`; it is hidden otherwise.

- [ ] "Use my location" on a real phone with real GPS (verified only with browser geolocation emulation).
- [ ] Precise India boundary: no official boundary file is bundled. Without `INDIA_BOUNDARY_GEOJSON`, points in neighbouring countries inside India's bounding box are accepted.
- [ ] State/district are not derived offline from coordinates (they need the reporter, an admin or the optional geocoder).
- [ ] Server-side reverse geocoding at submission time, and forward search (type a place name to place the pin).
- [ ] Video metadata stripping (needs a transcoder such as ffmpeg). Until then videos stay admin-only.
- [ ] Malware scanning of uploads; persistent/shared rate limiting; rate limiting on admin login.
- [ ] `uvicorn --reload` restart on code change. The server starts and detects changes. In this
      session's background (non-console) shell, the restart did not complete. Uvicorn on Windows
      likely restarts via a console Ctrl+C event, so this may be environment-specific. Untested in
      an interactive terminal.
- [ ] PostgreSQL via `DATABASE_URL` (including the migrations): not tested.
- [ ] Real terrain attributes: replace demo estimates with DEM / NDVI / soil-map values.
- [ ] Calibrate the heuristic and retrain the ML model on a real landslide inventory with negative samples, using spatial/temporal validation. Extend monitoring beyond the Northeast only with real local data.
- [ ] Scheduled automatic refresh, for example every hour (currently manual or at first start).
- [ ] Forecast-based risk using Open-Meteo forecast hours.
- [ ] Multiple admin roles; full migration tooling (Alembic) for renames/type changes.
- [ ] Notifications (SMS / email / push) for new alerts.
- [ ] A committed end-to-end browser test suite (e.g. Playwright). The browser checks were scripted runs in this session, not part of the repo.
