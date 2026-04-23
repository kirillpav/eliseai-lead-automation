# EliseAI Lead Processing Pipeline

This repo now contains two connected pieces:

1. A Google Sheets-bound Apps Script pipeline that enriches and scores inbound leads.
2. A standalone Next.js web app that receives both mirrored lead-processing snapshots and generation-call logs over HTTP.

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
- `ANALYTICS_BASE_URL` optional, base URL for the standalone web app, for example `https://analytics.internal.example`
- `ANALYTICS_INGEST_TOKEN` optional, shared bearer token used when posting generation logs

If `ANALYTICS_BASE_URL` or `ANALYTICS_INGEST_TOKEN` is missing, lead processing still runs and analytics delivery is skipped.

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

The dashboard lives in [web/package.json](/Users/kirillpavlov/Projects/eliseai-automating-inbdound-leads/web/package.json) and stores data in SQLite.

### Web App Setup

1. Install dependencies:
   - `cd web && npm install`
2. Copy [web/.env.example](/Users/kirillpavlov/Projects/eliseai-automating-inbdound-leads/web/.env.example) to `web/.env.local`
3. Configure:
   - `DATABASE_URL`
   - `INGEST_TOKEN`
   - `OPENAI_PRICING_JSON`
4. Start the app:
   - `npm run web:dev`

### Pricing Configuration

`OPENAI_PRICING_JSON` is a model-keyed JSON object with per-1M-token rates. Example shape:

```json
{
  "gpt-5.4-mini": {
    "input": 0.0,
    "cached_input": 0.0,
    "output": 0.0
  }
}
```

Replace the placeholder values with the rates you want the dashboard to apply at ingest time.

### Ingestion Contract

The web app exposes:

- `POST /api/ingest/generation`

Authentication:

- `Authorization: Bearer <INGEST_TOKEN>`

The Apps Script producer sends two best-effort POST streams:

- `POST /api/ingest/lead` for mirrored lead-processing snapshots
- `POST /api/ingest/generation` for raw OpenAI generation traces

Lead snapshots include the same processing state the sheet script uses: input, normalized lead, enrichment, address validation, location context, scoring, rep outputs, and final row output. Generation traces still include prompt, output, request payload, response JSON, token usage, and pricing.

## Tests

- `npm run typecheck`
- `npm test`
- `npm run web:typecheck`
