# EliseAI Lead Processing Pipeline

This repo contains two pieces that share one source of truth — the leads spreadsheet:

1. A Google Sheets-bound Apps Script pipeline that enriches and scores inbound leads.
2. A standalone Next.js web app in [`web/`](web/) that mirrors the same sheet via the Google Sheets API, polls for updates, and lets you add new leads.

## Apps Script Setup

1. Install root dependencies:
   - `npm install`
2. Copy `.clasp.json.example` to `.clasp.json` and replace the placeholder script ID.
3. Build the Apps Script bundle:
   - `npm run build`
4. Push the bundle:
   - `npx clasp push`

### Script Properties

Configure these in Apps Script `Project Settings -> Script properties`:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` default: `gpt-5.4-mini`
- `THECOMPANIES_API_KEY`
- `CENSUS_API_KEY` optional
- `LEADS_SHEET_NAME` optional, default: `Leads`
- `SWEEP_INTERVAL_MINUTES` optional, default: `5`
- `ANALYTICS_BASE_URL` optional — base URL of an external sink for generation/lead snapshots. The Apps Script will best-effort POST events when set.
- `ANALYTICS_INGEST_TOKEN` optional — bearer token sent with analytics requests.

If either analytics property is missing, lead processing still runs and analytics delivery is silently skipped.

### Sheet Columns

Required headers:

- `Name`
- `Email`
- `Company`
- `Property Address`
- `City`
- `State`
- `Country`
- `Company Domain`
- `Company Website`
- `Enriched Company Info`
- `Address / Property Validation`
- `Lead Score`
- `Lead Score Reason`
- `Sales Insights`
- `Draft Outreach Email`
- `Status`
- `Last Processed At`

### Runtime Entry Points

- `onOpen`
- `onEdit`
- `processNewLeadRows`
- `processLeadRow`
- `installTriggers`
- `resetTriggers`
- `ensureLeadSheet`

## Standalone Web App

The dashboard lives in [`web/`](web/) as an independent Next.js project. It reads and writes the same Google Sheet via the Sheets API using a service account, and the dashboard polls every 10 seconds so that new or updated rows in the sheet appear in the UI shortly after.

### Web App Setup

1. Install dependencies: `cd web && npm install`.
2. Create a Google Cloud service account and JSON key, enable the Google Sheets API, and share the target sheet with the service account email as Editor.
3. Copy [`web/.env.example`](web/.env.example) to `web/.env.local` and fill in `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `LEADS_SHEET_NAME`, and `WEB_APP_USER` / `WEB_APP_PASSWORD` (Basic Auth credentials).
4. `npm run dev` and open http://localhost:3000.

See [`web/README.md`](web/README.md) for the full setup walkthrough.

### Important: Sheets-API writes do not fire `onEdit`

A row added through the web app's "Add Lead" form is appended to the sheet via the Sheets API, which does **not** trigger the Apps Script `onEdit` handler. The time-based sweep (`processNewLeadRows`, default every 5 minutes) is what picks those rows up. Run `installTriggers` once from the Apps Script editor so the sweep is active.

## Tests

- `npm run typecheck`
- `npm test`
