# LandslideGuard AI

A landslide risk monitoring and early-warning **prototype**. It has two parts with different scope:

- **Risk monitoring: Northeast India only** (Assam, Arunachal Pradesh, Manipur, Meghalaya, Mizoram,
  Nagaland, Sikkim and Tripura). It combines a transparent, rule-based risk index with an experimental
  machine-learning model, shows the results on a dashboard and an interactive map, and raises alerts.
- **Citizen incident reporting: all of India.** Anyone can report a landslide, flood, blocked road,
  ground cracks, soil movement or a similar incident. Each report carries a location (device GPS, map
  selection or typed coordinates), a time, and an optional photo or video. Administrators review every
  report before it is shown publicly.

> **Not an official warning service.** LandslideGuard AI has not been validated against observed
> landslide events. Always follow advisories from IMD, GSI, NDMA and your State/District Disaster
> Management Authority. In an emergency call **112**.

---

## Contents

1. [What is real and what is demo data](#1-what-is-real-and-what-is-demo-data)
2. [Features](#2-features)
3. [Quick start (Windows)](#3-quick-start-windows)
4. [Running tests](#4-running-tests)
5. [Configuration](#5-configuration)
6. [How risk is computed](#6-how-risk-is-computed)
7. [ML training pipeline](#7-ml-training-pipeline)
8. [Nationwide incident reporting](#8-nationwide-incident-reporting)
9. [REST API](#9-rest-api)
10. [Project structure](#10-project-structure)
11. [Known limitations](#11-known-limitations)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. What is real and what is demo data

| Data | Source | Status |
|---|---|---|
| 46 monitoring locations | District HQ towns across the 8 states, approximate town-centre coordinates | Sample data |
| Slope, soil type, vegetation (NDVI), road cuts | Hand-written estimates in `backend/data/locations_ne_india.json` | **Demo estimates**, not DEM or satellite derived |
| Rainfall (24 h / 72 h) and soil moisture | `WEATHER_PROVIDER=open-meteo`: live numerical-weather-model data from [Open-Meteo](https://open-meteo.com) (no API key). `WEATHER_PROVIDER=demo`: deterministic simulation | Live **model** data (not rain gauges), or **simulated** |
| ML training data | `backend/ml/synthetic.py`, a documented synthetic generator, or your own labelled CSV | **Synthetic** by default |
| Citizen reports | Submitted by users from anywhere in India; reviewed by an admin | Real user input; 6 `[DEMO]` samples on a fresh install |
| Risk at a reported location | Only near (≤ 25 km) a monitored Northeast town, shown as that town's model estimate | Elsewhere: **"Risk assessment unavailable"**. No score is invented |
| Address suggestions | Optional reverse geocoding via OpenStreetMap Nominatim | Off by default |
| Base map | OpenStreetMap tiles via Leaflet | Live |

Every assessment stores its `data_source`. The UI shows **DEMO** tags wherever simulated values are used.
Alerts generated from simulated data are titled `[DEMO]` and state that they are not real warnings.
The ML model card shows a prominent synthetic-data warning, and the model is never used to trigger alerts.

The UI uses four distinct labels:

| Label | Meaning |
|---|---|
| **Unverified citizen report** | Just received and not yet checked |
| **Verified incident** | Confirmed by an admin |
| **Model estimate** | A computed risk index or an automatic alert |
| **Official warning** | Relayed by an admin who names the issuing body (IMD/NDMA/SDMA/DDMA) |

Report verification is completely separate from risk prediction.

## 2. Features

Pages and routes:

| Route | Page |
|---|---|
| `/` | Home: hero, live figures, features, latest verified incidents |
| `/dashboard` | Dashboard |
| `/incidents` | India-wide incident map |
| `/report` | Report wizard |
| `/reports/:id` | Report details and verification history |
| `/map` | Risk monitor (Northeast India) |
| `/alerts` | Alerts |
| `/assess` | Assess risk |
| `/methodology` | Methodology |
| `/locations/:id` | Monitored town |
| `/admin` | Admin console |

The UI is responsive (phone, tablet, desktop): white surfaces, a forest-green accent and navy text. It has
loading skeletons, empty states, error messages with retry, accessible tooltips and keyboard-friendly
controls.

- **Home**: an illustrated hill/landslide hero, "Report. Monitor. Stay Safer.", live figures from the API,
  feature cards, how verification works, and the latest verified incidents.
- **Dashboard**: two clearly separated sections.
  - **Citizen reports – all India**:
    - total reports, verified incidents, active alerts and critical locations;
    - incident-type chart and 30-day trend;
    - recent-reports table with status badges.
  - **Risk monitoring – Northeast India (model estimates)**: level distribution, average by state,
    rainfall vs risk, active alerts and the highest-risk towns.

  Every chart has a table view.
- **Risk map**: Leaflet + OpenStreetMap, markers coloured by level, popups with factors, state and
  level filters, and verified citizen reports.
- **Assess Risk**: enter site conditions (or prefill from a location). The page shows the risk index,
  each factor's sub-score and weight, and the ML probability with per-feature explanations.
- **Report an incident** (`/report`), from anywhere in India, as a 4-step wizard: details → location →
  photo/video → review & submit, ending on a confirmation screen with a reference number and a
  "Track this report" link:
  - The report contains:
    - 11 incident types: landslide, debris flow, rockfall, ground or slope cracks, soil movement, land
      subsidence, flood, flash flood, seepage, blocked road, other;
    - the severity and the time it happened;
    - a description;
    - the location, from "Use my location" (browser GPS), a click or drag on an India-wide map, or
      typed coordinates;
    - optional state, district, address and landmark;
    - an optional photo or video.
  - The form shows where the coordinates came from.
  - Photos are re-encoded on the server, which strips EXIF metadata including GPS.
- **Incident map** (`/incidents`): reports across India.
  - **Search:** by state, district, landmark, text or `#ID`. A place-name search appears when address
    lookup is configured.
  - **Filters:** state, district, incident type, severity, date and verification status.
  - **Details:** clicking a marker opens a details panel.
  - **Admin view:** signed-in admins can switch to "all statuses".
- **Report details** (`/reports/:id`):
  - description, media, details, a mini-map and "Open on incident map";
  - the verification history: who changed what and when for admins, "by an administrator" for the
    public;
  - unpublished reports show only their status and timeline, so reporters can follow them without
    exposing the content.
- **Alerts**:
  - Raised automatically when a monitored location reaches High or Very High, and resolved
    automatically when the level drops.
  - Admins can also issue advisories, or relay an official warning by naming its source.
- **Admin console** (sidebar, profile menu in the header):
  - Use the reports table with status counts, search and filters.
  - Click a report to open the review panel: media, details, verify / resolve / reject / back to
    unverified, internal notes, location corrections and the full history.
  - Review reports with their location source and GPS accuracy, photo and video metadata, and any
    possible duplicate.
  - Reach the reported spot from any report card:
    - **Get directions** opens Google Maps navigation (the Maps app on a phone);
    - **Show on incident map** zooms our map to the report;
    - **Copy coordinates** is for sharing with a field team.
  - Verify, resolve, reject, annotate or delete reports, and correct state, district or address.
  - Issue and resolve alerts, and re-run the assessment for all locations.
- **Methodology page**: the full formula, weights, thresholds and the ML model card (metrics against
  trivial baselines, cross-validated candidates, permutation importance, dataset hash).

## 3. Quick start (Windows)

Prerequisites: **Python 3.11+** and **Node.js 20.19+ or 22+**. The commands below are for
**PowerShell**, run from the project folder `C:\Users\paldi\Desktop\Landslide_Guard`.

### First-time setup

```powershell
# Backend: virtual environment, dependencies, config, ML model
cd C:\Users\paldi\Desktop\Landslide_Guard\backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
copy .env.example .env
.\.venv\Scripts\python -m ml.train

# Frontend: dependencies
cd C:\Users\paldi\Desktop\Landslide_Guard\frontend
npm install
```

`.env.example` sets `WEATHER_PROVIDER=open-meteo` (live data, needs internet). For fully offline,
simulated data, set `WEATHER_PROVIDER=demo` in `backend\.env`, or skip the `copy` step.

### Start the app (two terminals)

**Terminal 1: API** (http://localhost:8000, interactive docs at http://localhost:8000/docs)

```powershell
cd C:\Users\paldi\Desktop\Landslide_Guard\backend
.\.venv\Scripts\python -m uvicorn app.main:app --port 8000
```

While editing backend code, add `--reload` to restart automatically on changes.

**Terminal 2: web app** (http://localhost:5173)

```powershell
cd C:\Users\paldi\Desktop\Landslide_Guard\frontend
npm run dev
```

Open **http://localhost:5173**. The Vite dev server forwards `/api` to the backend.

On first start the backend creates `backend\landslideguard.db`, seeds the 46 locations and 6 demo
reports, and runs a first assessment.

### Upgrading an existing database

There is nothing to run by hand. On start the backend checks the `schema_migrations` table and applies
any pending migrations:
- New columns are added in place.
- Existing rows are kept. Older reports get location source `unknown`, and their receive time is
  used as the incident time.
- For SQLite, a copy is saved first as `backend\landslideguard.db.backup-<UTC time>`.

To roll back, stop the backend and copy the backup over `landslideguard.db`.

**Admin sign-in:** username `admin`, password `change-me-now`. Change `ADMIN_PASSWORD` and set
`SECRET_KEY` in `backend\.env`. The password is re-synced from `.env` on every start.

### Single-process mode (optional)

Build the frontend once. FastAPI then serves it together with the API on one port:

```powershell
cd C:\Users\paldi\Desktop\Landslide_Guard\frontend
npm run build
cd ..\backend
.\.venv\Scripts\python -m uvicorn app.main:app --port 8000
```

Open http://localhost:8000.

### Reset to a fresh database

Stop the backend, then:

```powershell
cd C:\Users\paldi\Desktop\Landslide_Guard\backend
del landslideguard.db
```

The next start re-seeds everything.

## 4. Running tests

```powershell
# Backend: 172 tests (risk engine, ML pipeline, weather, alerts, REST API, nationwide reports,
#          India coordinates, migrations, media privacy, geocoding, duplicates, history, SPA hosting)
cd C:\Users\paldi\Desktop\Landslide_Guard\backend
.\.venv\Scripts\python -m pytest

# Frontend: 58 unit tests (incl. GPS success/denial/timeout, map/manual location source, wizard
#           step validation, India coordinates, file validation, search, history, directions links),
#           then a production build
cd C:\Users\paldi\Desktop\Landslide_Guard\frontend
npm test
npm run build
```

Backend tests run against a temporary SQLite database, upload folder and model directory. They never
touch your data and never call the internet (Open-Meteo and Nominatim are mocked).

## 5. Configuration

### Backend (`backend\.env`, see `backend\.env.example`)

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | SQLite file `backend\landslideguard.db` | Any SQLAlchemy URL |
| `WEATHER_PROVIDER` | `demo` (`.env.example`: `open-meteo`) | `demo` = simulated, `open-meteo` = live model data, with labelled fallback to demo if the request fails |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | `admin` / `change-me-now` | Bootstrap admin account. Startup is refused in `ENVIRONMENT=production` with the default password |
| `SECRET_KEY` | random per process | Signs admin tokens. Set it, or tokens expire on every restart |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Only needed if the frontend is served from another origin |
| `SEED_DEMO_DATA` | `true` | Seed locations, demo reports and a first assessment (empty database only) |
| `MAX_UPLOAD_MB` | `5` | Photo size limit |
| `VIDEO_UPLOADS_ENABLED` / `MAX_VIDEO_MB` | `true` / `25` | Optional videos (admin-only) |
| `MEDIA_URL_TTL_SECONDS` | `3600` | Lifetime of the signed links admins use to view media |
| `INDIA_BOUNDARY_GEOJSON` | empty | Path to an official India boundary (GeoJSON Polygon/MultiPolygon) for precise location checks |
| `PUBLIC_SHOW_UNVERIFIED` | `false` | Also show unverified reports publicly (labelled). Their photos stay private |
| `REPORT_RATE_LIMIT_PER_HOUR` | `30` | New reports per client IP per hour (`0` = off) |
| `GEOCODER_PROVIDER` | `none` | `nominatim` to suggest state/district/address. Also set `GEOCODER_USER_AGENT` |
| `GEOCODER_URL` / `GEOCODER_USER_AGENT` / `GEOCODER_EMAIL` | Nominatim / empty / empty | Identify your app as the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) requires |

### Frontend (`frontend\.env.local`, see `frontend\.env.example`)

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_BASE_URL` | empty (same origin) | Backend URL as seen by the browser |
| `VITE_DEV_BACKEND_URL` | `http://127.0.0.1:8000` | Target of the dev-server proxy |
| `VITE_MAP_TILE_URL` / `VITE_MAP_ATTRIBUTION` | OpenStreetMap | Use your own tile server for production traffic ([OSM tile policy](https://operations.osmfoundation.org/policies/tiles/)) |

## 6. How risk is computed

The **primary, transparent index** (`backend/app/services/risk_engine.py`) follows the hazard
formulation *risk = susceptibility × trigger*:

```
S = 0.45·slope + 0.20·soil + 0.20·road_cut + 0.15·(1 − NDVI)        (terrain, 0–1)
T = 0.40·rain_24h + 0.40·rain_72h + 0.20·soil_moisture                (trigger, 0–1)
score = 100 × S × (0.25 + 0.75 × T)                                   (0–100)
```

Each input is first mapped to a 0–1 sub-score:

| Input | Sub-score rule |
|---|---|
| Slope | 0 at 5°, 1 at 40° |
| Rainfall, 24 h | 0 at 0 mm, 1 at 150 mm |
| Rainfall, 72 h | 0 at 0 mm, 1 at 300 mm |
| Soil moisture | 0 at 0.15, 1 at 0.45 m³/m³ |
| Soil type | rock 0.2, sandy 0.5, loamy 0.6, clay 0.9 |

Levels: **Low** < 25 ≤ **Moderate** < 50 ≤ **High** < 75 ≤ **Very High**.

These weights and thresholds are **documented assumptions, not calibrated values**. They should be
reviewed by domain experts and calibrated against a landslide inventory before any operational use.
The API serves the exact parameters at `GET /api/risk/methodology`.

The **ML model** is secondary and experimental. It appears next to the index, with per-feature
explanations computed by occlusion: each feature is replaced with its training median and the change
in probability is reported. It is never used for alerts.

## 7. ML training pipeline

```powershell
cd C:\Users\paldi\Desktop\Landslide_Guard\backend
.\.venv\Scripts\python -m ml.train                       # synthetic data, seed 42, 6000 rows
.\.venv\Scripts\python -m ml.train --seed 7 --n-samples 10000
.\.venv\Scripts\python -m ml.train --data C:\path\to\inventory.csv   # your own labelled data
```

The pipeline:

1. Validates the dataset: schema, value ranges, at least 50 rows and at least 10 rows per class.
2. Makes a stratified 80/20 train/test split.
3. Compares logistic regression, random forest and gradient boosting by 5-fold stratified CV ROC-AUC on
   the training split.
4. Refits the best model and evaluates it once on the held-out test split. Reports ROC-AUC, average
   precision, Brier score, accuracy, precision, recall, F1 and the confusion matrix, next to trivial
   baselines.
5. Computes permutation importance.
6. Writes `ml/artifacts/model.joblib`, `model_card.json` and `training_data.csv`. The card records the
   dataset SHA-256, seed, command and library versions.

The running API reloads the model automatically when the artifacts change.

Nothing in the model card is hand-written. A test (`tests/test_ml_pipeline.py`) recomputes the
reported ROC-AUC from the saved model, and another checks that two runs with the same seed give
identical results.

**With synthetic data, the metrics only show how well the model recovers the hand-written generating
process in `ml/synthetic.py`.** They say nothing about real-world accuracy, and the model card and UI
say so.

### Using real data

Provide a CSV with these columns, one row per location and time window:

| Column | Type / range |
|---|---|
| `rainfall_24h_mm` | 0 – 600 |
| `rainfall_72h_mm` | 0 – 1500 |
| `soil_moisture` | 0 – 0.6 (m³/m³) |
| `slope_deg` | 0 – 70 |
| `vegetation_ndvi` | 0 – 1 |
| `slope_modified` | 0 / 1 |
| `soil_type` | `rock`, `sandy`, `loamy`, `clay` |
| `landslide` | 1 = landslide occurred, 0 = none |

Possible sources:
- Landslide events: GSI landslide inventory (Bhukosh portal), NASA Global Landslide Catalog.
- Rainfall: IMD gridded rainfall, GPM IMERG.
- Slope: SRTM or Cartosat DEM.
- NDVI: Sentinel-2 or MODIS.
- Soil: soil maps.

You also need representative **negative** samples, meaning places and times without landslides. Use
spatially or temporally separated validation, because random splits are optimistic for this kind of data.

## 8. Nationwide incident reporting

**Geographic scope.** Reports are accepted for locations in India.

- **Always:** the server rejects coordinates that are not valid numbers or that lie outside India's
  bounding box (about 6–37.6° N, 68–97.6° E). For example London, Karachi, Dubai and 0,0 are rejected.
  The bounding box also contains parts of Nepal, Bangladesh, Sri Lanka and other neighbours, and points
  there pass this check.
- **Precise checking:** set `INDIA_BOUNDARY_GEOJSON` to an official boundary file, for example from the
  Survey of India. The project deliberately ships no hand-drawn boundary.
- **With the address lookup on:** the form warns if the lookup places the point outside India.

**Location sources.** Each report stores `location_source`:

| Value | How the coordinates were set | Notes |
|---|---|---|
| `gps` | "Use my location" (browser Geolocation API) | The device accuracy is stored too |
| `map` | Click or drag on the map | |
| `manual` | Typed coordinates | |
| `unknown` | Reports created before this upgrade | |

- The form only sets `gps` from a real device fix. A denied permission, an unavailable position or a
  timeout each show a specific message and leave the coordinates empty.
- Browser geolocation works only on `https://` or `http://localhost`. On `http://<LAN IP>` the form
  explains this and offers the map instead.

**State, district, address.** These are entered by the reporter, or suggested by the optional address
lookup and then editable. Admins can correct them later; coordinates are never changed. Without the
address lookup the app cannot work out state or district from coordinates by itself, so such reports
show "State not given" until someone fills them in.

**Media and privacy.**
- **Photos** (JPEG/PNG/WebP, ≤ `MAX_UPLOAD_MB`) are decoded and re-encoded, which removes EXIF metadata
  including GPS. The size, dimensions, SHA-256 and camera time are kept for verification.
- **Videos** (MP4/MOV/WebM/3GP, ≤ `MAX_VIDEO_MB`) are checked by their file signature but not
  re-encoded. Embedded metadata may remain, so videos are only ever served to admins.
- **Access:** nothing is served as a public static folder.
  - Photos become public only after a report is verified or resolved (`/api/reports/{id}/photo`).
  - Admins open media through short-lived signed links.
- **Personal details:** reporter name, contact and address are admin-only.

**Duplicates and abuse.**
- **Idempotency key:** the form sends a `client_submission_id`, so a retry or double click returns the
  original report (`200`, `duplicate: true`) instead of creating a second one.
- **Content check:** an identical report (same type and text, within about 50 m, within 10 minutes) is
  also treated as a resubmission.
- **Same photo:** a photo already used in another report is flagged to admins as "possible duplicate".
- **Rate limit:** a per-IP limit (`REPORT_RATE_LIMIT_PER_HOUR`) returns `429`. IPs are not stored.

**Risk at a reported location.** The landslide model is not assumed to be valid across India.
- Within 25 km of a monitored Northeast town, the form shows that town's latest model estimate, labelled
  as such.
- Everywhere else it shows **"Risk assessment unavailable"** instead of a number.

## 9. REST API

Full interactive documentation: **http://localhost:8000/docs**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | – | Liveness |
| GET | `/api/meta` | – | Weather provider, model status, disclaimer, reporting coverage, states, limits |
| GET | `/api/dashboard/summary` | – | Aggregated statistics for the dashboard |
| GET | `/api/locations?state=` | – | Locations with their latest assessment |
| GET | `/api/locations/{id}?history=30` | – | Location detail and assessment history |
| POST | `/api/risk/predict` | – | Index + ML estimate for given inputs (JSON) |
| GET | `/api/risk/methodology` | – | Weights, thresholds, levels, guidance |
| GET | `/api/risk/model` | – | ML model card |
| GET | `/api/risk/context?lat=&lon=` | – | Nearby monitored-town estimate, or `unavailable` |
| GET | `/api/geocode/reverse?lat=&lon=` | – | Address suggestion. `status`: `ok`, `not_found`, `error` or `disabled` |
| GET | `/api/alerts?status=active\|resolved\|all&state=` | – | Alerts (with `official_source` when relayed) |
| POST | `/api/reports` | – | Create a report (multipart; see below) |
| GET | `/api/reports?state=&district=&category=&severity=&status=&date_from=&date_to=` | – | Public reports, without personal details |
| GET | `/api/reports/{id}` | – | One report with its public history; unpublished reports return only status and timeline |
| GET | `/api/reports/{id}/photo` | – | Photo of a verified/resolved report |
| GET | `/api/geocode/search?q=` | – | Find places in India by name (when address lookup is configured) |
| POST | `/api/admin/login` | – | Returns a bearer token |
| GET | `/api/admin/me` | Bearer | Current admin |
| GET | `/api/admin/reports?` (same filters, any status) | Bearer | All reports, with contact details, media metadata and signed media links |
| GET | `/api/admin/reports/{id}` | Bearer | One report with its full history (usernames, notes and edits) |
| PATCH / DELETE | `/api/admin/reports/{id}` | Bearer | Status, notes, state/district/address corrections / delete with media |
| GET | `/api/admin/media/{id}/photo\|video?exp=&sig=` | Signed link | Media for admins |
| POST | `/api/admin/alerts` | Bearer | Issue an advisory, or relay an official warning (`official_source`, `official_reference`) |
| PATCH | `/api/admin/alerts/{id}` | Bearer | Resolve, reactivate or edit an alert |
| POST | `/api/admin/assessments/refresh` | Bearer | Fetch weather, recompute all locations, sync alerts |

`POST /api/reports` form fields:

| Field | Required | Allowed values |
|---|---|---|
| `category` | yes | an incident type, e.g. `landslide`, `flood`, `road_blocked` |
| `description` | yes | 10–2000 characters |
| `latitude`, `longitude` | yes | a location in India |
| `location_source` | yes | `gps`, `map` or `manual` |
| `location_accuracy_m` | no | stored only for `gps` |
| `observed_at` | no | ISO 8601; defaults to now; not in the future; at most 1 year ago |
| `observed_severity` | no | `minor`, `moderate` or `severe` |
| `state` | no | one of the 36 states/UTs; common aliases are accepted |
| `district`, `address`, `location_text` | no | free text |
| `reporter_name`, `reporter_contact` | no | free text |
| `client_submission_id` | no | 8–64 characters, `A-Z a-z 0-9 _ -` |
| `photo`, `video` | no | files |

Responses:

| Status | Meaning |
|---|---|
| `201` | Report created |
| `200` | `duplicate: true`: the original report is returned |
| `422` | Validation error |
| `429` | Rate limited |

## 10. Project structure

```
Landslide_Guard/
├── README.md, CHECKLIST.md, .gitignore
├── backend/
│   ├── requirements.txt, .env.example, pytest.ini
│   ├── app/
│   │   ├── main.py            FastAPI app, startup (migrations, seeding), optional SPA hosting
│   │   ├── config.py          Settings from env / .env
│   │   ├── database.py        SQLAlchemy engine + session
│   │   ├── migrations.py      Versioned in-place schema migrations with SQLite backup (v2 nationwide, v3 history)
│   │   ├── models.py          Location, RiskAssessment, Alert, CitizenReport, ReportEvent, AdminUser
│   │   ├── schemas.py         Pydantic request/response models
│   │   ├── security.py        PBKDF2 password hashing, HMAC-signed tokens (stdlib only)
│   │   ├── seed.py            Admin, locations, demo reports, first assessment
│   │   ├── routers/           meta, locations, dashboard, risk, reports, alerts, admin, geocode
│   │   └── services/          risk_engine, ml_model, weather, assessment, uploads, features, queries,
│   │                          geo (India coverage), geocoding, media_access, report_guard, risk_context
│   ├── ml/
│   │   ├── synthetic.py       Documented synthetic data generator
│   │   ├── train.py           Training / evaluation CLI → artifacts/
│   │   └── artifacts/         model.joblib, model_card.json, training_data.csv
│   ├── data/locations_ne_india.json
│   └── tests/                 pytest suite
└── frontend/
    ├── package.json, vite.config.js, .env.example, index.html
    └── src/
        ├── api/client.js      fetch wrapper + endpoints
        ├── lib/               auth (shared admin session), risk labels, india, geolocation, reportForm,
        │                      history, incidentSearch, navigation, useAsync (+ unit tests)
        ├── components/        Layout (header/profile menu/footer), ui (design system), Charts, RiskMap,
        │                      ReportView, History, HeroArt, FactorBreakdown, Icons
        └── pages/             Home, Dashboard, Incidents, Report (wizard), ReportDetail, Map, Assess,
                               Alerts, Methodology, Location, Admin, NotFound
```

Stack: React 19, Vite 7, Tailwind CSS 4, React Router 7, Recharts 3, Leaflet 1.9 + react-leaflet 5,
FastAPI, SQLAlchemy 2, Pydantic 2, scikit-learn, SQLite.

## 11. Known limitations

- **Scientific validity:**
  - The index is uncalibrated.
  - The ML model is trained on synthetic data by default.
  - Terrain attributes are estimates at town centres, not slope-unit or DEM-cell values.
  - Risk monitoring covers only 46 Northeast towns. There is no risk assessment for the rest of India.
- **Weather:**
  - Open-Meteo values are model estimates at a grid cell, not rain-gauge observations.
  - There is no forecast-based (future) risk yet.
  - Refreshes are manual (Admin → System) or happen on the first start; there is no scheduler.
- **Geographic checks:**
  - Without `INDIA_BOUNDARY_GEOJSON`, only India's bounding box is enforced, so points in neighbouring
    countries inside that box are accepted.
  - State and district come from the reporter or the optional lookup; they are not derived from the
    coordinates offline.
  - OpenStreetMap/Nominatim boundaries may differ from official Survey of India depictions.
- **Location source:** `location_source` and GPS accuracy are reported by the browser. The app never
  invents them, but the server cannot prove that a client really used GPS.
- **Security** (fine for a local prototype, not yet for public deployment):
  - There is a single admin role and no rate limiting on admin login.
  - The report rate limit is in memory, per IP, and resets on restart. Behind the Vite dev proxy or
    another reverse proxy, every user shares one IP.
  - Videos are not re-encoded, so their metadata is not stripped; they are admin-only for that reason.
  - There is no malware scanning of uploads.
  - Tokens are kept in `sessionStorage`.
- **Database:**
  - Migrations are a small built-in system (`app/migrations.py`) that adds columns and indexes. It does
    not handle renames or type changes; consider Alembic for that.
  - PostgreSQL should work through `DATABASE_URL` (install `psycopg[binary]`), but it has **not been
    tested**, including the migrations.
- **Address lookup:** the public Nominatim service is for light use (1 request/second). Use your own
  instance or a commercial geocoder for heavy traffic.

## 12. Troubleshooting

| Problem | Fix |
|---|---|
| UI says "Cannot reach the LandslideGuard API" | Start the backend (Terminal 1) on port 8000 |
| `http://127.0.0.1:5173` does not load | Use `http://localhost:5173`. Vite listens on `localhost`, which may resolve to IPv6 only |
| Port already in use | `netstat -ano \| findstr :8000`, then stop that process, or use `--port 8001` and set `VITE_DEV_BACKEND_URL` |
| Admin token rejected after restart | Set `SECRET_KEY` in `backend\.env` |
| ML section says "No trained model" | `.\.venv\Scripts\python -m ml.train` in `backend` |
| Live weather fails | The refresh result shows a warning and falls back to labelled demo data. Check internet access to `api.open-meteo.com` |
| `Activate.ps1 cannot be loaded` | Not needed: the commands above call `.\.venv\Scripts\python` directly |
| "Use my location" says permission denied | Allow location for the site in the browser (padlock icon in the address bar), or tap the map instead |
| "Use my location" fails when opened via `http://192.168.x.x:5173` | Browsers allow geolocation only on `https://` or `localhost`. Use the map or typed coordinates, or serve over HTTPS |
| Report rejected with "outside India" | Check the coordinates are decimal degrees (e.g. `31.1048`, `77.1734`), with latitude first |
| Something went wrong after an upgrade | Stop the backend and copy `landslideguard.db.backup-<time>` over `landslideguard.db` |
