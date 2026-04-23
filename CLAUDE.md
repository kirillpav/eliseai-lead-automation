# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run build` — bundles `src/index.ts` into `dist/code.js` via esbuild and copies `appsscript.json`. Always required before deploying.
- `npm run typecheck` — `tsc --noEmit` against `src/`, `tests/`, and `scripts/`.
- `npm test` — runs the Node test runner over `tests/*.test.ts` via `tsx`. Single test: `node --import tsx --test tests/scoring.test.ts`. Filter by name: append `--test-name-pattern "fragment"`.
- `npm run check` — typecheck + tests.
- `npx clasp push` — deploys `dist/` to the bound Apps Script project (requires `.clasp.json` with the real script ID; example in `.clasp.json.example`).

There is no lint step.

## Architecture

This is a Google Apps Script project written in TypeScript and bundled to a single IIFE that runs inside a Sheets-bound script. The codebase is **not** a normal Node app — it targets the Apps Script V8 runtime (`appsscript.json`), so `UrlFetchApp`, `SpreadsheetApp`, `PropertiesService`, `LockService`, and `ScriptApp` are runtime globals provided by Google. `src/http.ts` wraps `UrlFetchApp.fetch` — do not introduce `fetch` or `node:*` imports into `src/`.

### Build & module conventions

- esbuild (`scripts/build.mjs`) bundles `src/index.ts` as `format: "iife"`, `target: "es2019"`. The output is a single file Apps Script can load.
- TypeScript source uses **`.js` extensions on relative imports** (`from "./config.js"`). This is required for the ESM/Bundler resolution mode in `tsconfig.json` — keep this convention when adding files.
- Apps Script entry points must be on `globalThis`. `src/index.ts` does `Object.assign(globalThis, { onOpen, onEdit, processNewLeadRows, ... })` after bundling — any new function that triggers/menus/clasp need to call must be added there, not just `export`ed.

### Runtime configuration

`src/config.ts` is the single source of truth. All secrets and tunables come from Apps Script `PropertiesService.getScriptProperties()`:

- `OPENAI_API_KEY`, `OPENAI_MODEL` (default `gpt-5.4-mini`)
- `THECOMPANIES_API_KEY`, `CENSUS_API_KEY` (optional)
- `LEADS_SHEET_NAME` (default `Leads`), `SWEEP_INTERVAL_MINUTES` (default `5`)

There are no `.env` files — the harness has no concept of them.

### Lead-processing pipeline

The system ingests rows from the configured sheet and writes enrichment/scoring back to the same row. The flow:

1. **Trigger** — `onEdit` (installable via `installTriggers`) detects edits in the leads sheet, or the time-based `processNewLeadRows` sweep runs every `SWEEP_INTERVAL_MINUTES`. Both paths call `processLeadRow(rowNumber)`.
2. **Status state machine** (`src/constants.ts` `STATUS`): `"" → NEW → PENDING → ENRICHED | NEEDS_REVIEW | ERROR`. `initializeRowStatusIfBlank` only stamps `NEW` when a row has any input fields. `processLeadRow` is a no-op unless the row is `NEW`.
3. **Concurrency** — `processLeadRow` takes a `LockService.getDocumentLock()` for up to 30s. Do not remove the lock; concurrent edits + sweep can otherwise double-process a row.
4. **Pipeline stages** (`src/pipeline.ts`):
   - `normalizeLead` (`src/normalization.ts`) — cleans inputs, derives `emailDomain`, flags generic mailbox providers.
   - `buildAssessment` (`src/providers.ts`) — calls TheCompaniesAPI for company enrichment and the US Census geocoder for address validation + tract-level housing context. Each external call is wrapped in try/catch and returns an `empty*` shape on failure so the pipeline keeps running.
   - `scoreLead` (`src/scoring.ts`) — deterministic 0–100 score from `SCORE_WEIGHTS` plus keyword matching against `POSITIVE_FIT_KEYWORDS`/`NEGATIVE_FIT_KEYWORDS`/`STRONG_FIT_PHRASES`. Returns a `recommendedStatus` of `ENRICHED` or `NEEDS_REVIEW`.
   - `generateRepOutputs` (`src/llm.ts`) — calls OpenAI Responses API with a JSON-schema-constrained payload. Falls back to `buildFallbackRepOutputs` (`src/rep-output.ts`) on any error or missing key.
   - `writeRowOutput` (`src/sheets.ts`) — writes the full output row in a single `setValues` call. Errors anywhere in the pipeline are caught and written as `Status: ERROR` with the message in `Lead Score Reason`.
5. **Sheet schema** — `ALL_HEADERS` in `src/constants.ts` is the canonical column list. `ensureLeadSheet` appends any missing headers on open/edit; do not assume column order — always go through `HeaderMap` (built by `toHeaderMap`).

### Failure-handling philosophy

External integrations (TheCompaniesAPI, Census, OpenAI) are all best-effort. Every provider call returns a typed `empty*` shape on failure, and `scoreLead` is designed to degrade — it can produce a meaningful score with no enrichment data. When adding a new provider, follow the same pattern: wrap the call, return an empty/typed shape on failure, and let `scoreLead`/`buildSheetRowOutput` decide whether the row should land in `ENRICHED` or `NEEDS_REVIEW`.

### Tests

`tests/` uses the Node built-in test runner (`node --test`) via `tsx`, exercising pure modules (`normalization`, `scoring`) — they don't load Apps Script globals. Keep new pure logic in modules that don't import `UrlFetchApp`/`SpreadsheetApp` so it remains testable here; pipeline-level code that touches Apps Script globals can only be verified by deploying to a test sheet.
