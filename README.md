# EliseAI Lead Processing Pipeline

Google Sheets-bound Apps Script project for automated lead enrichment and scoring.

## Setup

1. Install dependencies:
   - `npm install`
2. Copy `.clasp.json.example` to `.clasp.json` and replace the placeholder script ID.
3. Build the Apps Script bundle:
   - `npm run build`
4. Push the bundle:
   - `npx clasp push`

## Script Properties

Configure these in Apps Script `Project Settings -> Script properties`:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` default: `gpt-5.4-mini`
- `THECOMPANIES_API_KEY`
- `CENSUS_API_KEY` optional
- `LEADS_SHEET_NAME` optional, default: `Leads`
- `SWEEP_INTERVAL_MINUTES` optional, default: `5`

## Sheet Columns

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

## Runtime Entry Points

- `onOpen`
- `onEdit`
- `processNewLeadRows`
- `processLeadRow`
- `installTriggers`
- `resetTriggers`
- `ensureLeadSheet`

## Tests

- `npm run typecheck`
- `npm test`
