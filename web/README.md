# EliseAI Leads — Web App

Standalone Next.js dashboard that mirrors the same Google Sheet the Apps Script pipeline reads from. View enriched leads in a cleaner UI and add new ones from a form. The Sheet stays the single source of truth.

## How sync works

- The dashboard polls `GET /api/leads` every 10 seconds.
- New leads added via the form are appended to the Sheet with a blank `Status`.
- The Apps Script time-based sweep (`processNewLeadRows`, default every 5 minutes) is what enriches them. **`onEdit` does not fire for Sheets API writes**, so the sweep must be installed (run `installTriggers` in the Apps Script editor once).

## Setup

### 1. Service account

1. Create a Google Cloud project (or reuse one).
2. Enable the Google Sheets API.
3. Create a service account, then a JSON key for it.
4. Open the target Google Sheet → Share → add the service account's `client_email` as Editor.

### 2. Env

```
cp .env.example .env.local
```

Fill in:

- `GOOGLE_SHEETS_ID` — from the Sheet URL.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — `client_email` from the JSON key.
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` — `private_key` from the JSON key. Keep the literal `\n` escapes; the loader unescapes them at runtime.
- `LEADS_SHEET_NAME` — must match the Apps Script `LEADS_SHEET_NAME` script property (default `Leads`).
- `WEB_APP_USER` / `WEB_APP_PASSWORD` — credentials for the Basic Auth prompt.

### 3. Run

```
npm install
npm run dev
```

Open http://localhost:3000. The browser will prompt for the Basic Auth user/password.

## Scripts

- `npm run dev` — local dev server.
- `npm run build` — production build.
- `npm run start` — run the production build.
- `npm run typecheck` — TypeScript check (no emit).
- `npm run lint` — `next lint`.

## Notes

- This project is intentionally a separate npm workspace from the root Apps Script project — they have incompatible TypeScript configs (Apps Script V8 vs. Node + React).
- Pure modules from `../src` (types, header constants) are imported via the `@shared/*` path alias rather than duplicated.
- `/api/health` is the only route that bypasses Basic Auth, useful for uptime checks.
