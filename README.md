# Japan Working Holiday Hub

A static, data-driven dashboard for people planning a UK → Japan Working Holiday.

## MVP scope

- Job opportunities
- Housing opportunities
- Working Holiday application preparation
- Browser-only progress storage
- GitHub-backed candidate/live data workflow
- Automated validation and GitHub Pages deployment

## Architecture

```text
AI workers
   │
   ├── data/candidate/jobs.json
   ├── data/candidate/housing.json
   └── data/candidate/visa-uk.json
                │
                ▼
          validation / QA
                │
                ▼
       data/live/*.json
                │
                ▼
          GitHub Pages
```

The frontend reads only `data/live/`. Automated research workers should write to `data/candidate/` first.

## Local preview

Run a static HTTP server from the repository root, for example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Validate and build

```bash
node scripts/validate.mjs
node scripts/build.mjs
```

The static build is written to `_site/`.

## Enable GitHub Pages

After the scaffold PR is merged:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions**.
3. Push to `main` or run the Pages workflow manually.

## Data rules

- Never invent listing facts.
- Every job/housing record must retain its original source URL.
- Visa information must use official Japanese government/diplomatic sources.
- Inferences must be labelled as inferences.
- A source outage must not automatically delete live data.
- The MVP does not store passports, bank statements or other sensitive application documents.
- User checklist progress stays in the visitor's browser.

## Current source policy

Visa sources are restricted to the official source registry in `data/sources.json`.

Job and housing source lists are intentionally empty until each source has been reviewed for reliability and appropriate automated/republication use.

## Important

This project is an independent planning tool, not a government service or immigration adviser. Official Japanese government and embassy/consulate information takes precedence.


## Phase 2 application assistance

The visa planner now includes:

- rules-based eligibility pre-check
- UK residence / London vs Edinburgh jurisdiction routing
- proof-of-funds and prior-participation checks
- official-source-backed document checklist
- browser-only Statement of Purpose notes
- browser-only 12-month itinerary workspace
- downloadable local planning notes

These tools are for preparation only. They do not determine visa eligibility and do not submit an application.

## Candidate promotion safety

Use:

```bash
node scripts/promote.mjs jobs
node scripts/promote.mjs housing
node scripts/promote.mjs visa
```

or run the **Promote candidate data** GitHub workflow manually.

Promotion is blocked when:

- a listing uses an unapproved source
- a source is marked unhealthy/quarantined
- a feed with at least 10 live records falls by more than 30% in one candidate update
- a visa candidate does not have `change_control.status: "approved"`

This is intentional: source failure should preserve last-known-good data instead of emptying the public site.

## Source approval

`data/source-candidates.json` records sources considered for automation.

Commercial job boards and housing portals are not approved merely because their pages are public. Prefer documented APIs/feeds, explicit partner/affiliate access, or direct sources with suitable reuse terms.


## Phase 3 autonomous workers

The repository now contains exact worker contracts under `automation/`.

The intended daily flow is:

```text
01:00 Jobs research ─────┐
02:00 Housing research ──┤
03:00 Visa monitor ──────┤
                         ▼
04:00 QA reviewer → candidate status = approved/rejected
                         │
                         ▼
05:15 UTC GitHub Action promotes approved candidates
                         │
                         ▼
                    live data
                         │
                         ▼
                    GitHub Pages
                         │
                         ▼
06:00 Site-health check
```

Research workers cannot approve their own output. Jobs and housing use constrained direct-source discovery: the canonical URL must be the original employer or housing-provider page, not a third-party aggregator.

Public automation/data freshness is visible at `/status.html`.

### Scheduled-task prompts

Each ChatGPT Scheduled Task can use a short launcher prompt such as:

```
Use the connected GitHub repository JulianPJ/jwhv-hub.
Read automation/common-contract.md and automation/jobs-worker.md from main.
Execute that worker contract completely for today's run.
```

Use the matching worker file for Housing, Visa, QA and Site Health.
