# Japan Working Holiday Hub

A static, data-driven dashboard for people planning a Working Holiday in Japan, with country-specific visa guidance and shared Japan-wide jobs/housing.

## MVP scope

- Job opportunities
- Housing opportunities
- Country-specific Working Holiday application preparation (UK and Australia detailed; global partner-country registry)
- Browser-only progress storage
- GitHub-backed candidate/live data workflow
- Automated validation and GitHub Pages deployment

## Architecture

```text
AI workers
   │
   ├── data/candidate/jobs.json
   ├── data/candidate/housing.json
   └── data/candidate/visa-*.json
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

The frontend reads approved visa rules from `data/live/`. Jobs and housing intentionally combine approved live records with active pending direct-source candidates, clearly labelled as pending review. Automated research should still write candidates first.

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

Jobs and housing use approved direct-source policies: canonical links must point to original employers/providers or clearly employer-authorised careers pages. Commercial aggregators are discovery-only.

## Important

This project is an independent planning tool, not a government service or immigration adviser. Official Japanese government and embassy/consulate information takes precedence.


## Phase 2 application assistance

The visa planner now supports a passport-market selector and includes:

- rules-based eligibility pre-check
- country-specific application routing (UK London/Edinburgh and Australia residence-based routing)
- country-specific proof-of-funds and prior-participation checks
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

The repository contains exact worker contracts under `automation/`, but only **two ChatGPT Scheduled Tasks** are active for JWHV Hub.

```text
01:00 Listings Research
      ├── jobs research
      └── housing research
              │
              ▼
04:00 QA & Publish
      ├── independently review pending listing candidates
      ├── approve/reject
      ├── trigger deterministic GitHub promotion
      └── verify the deployed site
              │
              ▼
         GitHub Pages
```

Visa monitoring is not currently scheduled. The planner uses verified market-specific rulesets stored in the repository plus a MOFA-backed registry of all current Working Holiday partner countries/regions. Official-source checks are required whenever a market ruleset is added or changed.

Research cannot approve its own output. Jobs and housing use constrained direct-source discovery: the canonical URL must be the original employer or housing-provider page, not a third-party aggregator.

Public automation/data freshness is visible at `/status.html`.


## Phase 6 move dashboard

`plan.html` combines browser-local state into a single planning view:

- target arrival date and countdown
- visa-checklist completion
- saved job/housing counts
- context-aware next actions
- planning milestones generated relative to arrival
- local milestone completion
- saved pay/rent snapshot
- downloadable move-plan summary

The milestones are organisational suggestions, not official visa deadlines. All plan state remains in browser `localStorage`.

## Phase 7 multi-market visa architecture

The Japan-side jobs and housing inventory is shared across users. Visa guidance is selected by passport market.

Current detailed planners:
- United Kingdom (`data/live/visa-uk.json`)
- Australia (`data/live/visa-au.json`)
- Germany (`data/live/visa-de.json`)

`data/live/visa-markets.json` tracks Japan's current Working Holiday partner countries/regions from MOFA and highlights EU/North American availability. The European Union is not treated as one visa market: eligibility and application rules are passport-country specific. The United States is shown as having no current Japan Working Holiday arrangement because it is not on MOFA's current partner list.

Browser-local eligibility, checklist and planning state is namespaced by selected market so one country's answers do not contaminate another country's planner.
