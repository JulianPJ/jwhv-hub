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
- Canada (`data/live/visa-ca.json`)
- New Zealand (`data/live/visa-nz.json`)
- France (`data/live/visa-fr.json`)
- Ireland (`data/live/visa-ie.json`)
- Netherlands (`data/live/visa-nl.json`)
- Italy (`data/live/visa-it.json`)
- Spain (`data/live/visa-es.json`)
- Portugal (`data/live/visa-pt.json`)
- Sweden (`data/live/visa-se.json`)

`data/live/visa-markets.json` tracks Japan's current Working Holiday partner countries/regions from MOFA and highlights EU/North American availability. The European Union is not treated as one visa market: eligibility and application rules are passport-country specific. The United States is shown as having no current Japan Working Holiday arrangement because it is not on MOFA's current partner list.

Browser-local eligibility, checklist and planning state is namespaced by selected market so one country's answers do not contaminate another country's planner.


## Phase 8 market expansion wave 1

Canada, New Zealand and France now use the same registry-driven planner architecture.

Notable country-specific behavior:
- Canada routes applicants by Canadian residential jurisdiction and supports mission-specific funds overrides where current official amounts are verified.
- New Zealand requires current NZ residence, in-person regional lodgement, and uses NZ$3,000 with a paid return ticket or NZ$4,000 without one.
- France is eligible in principle, but the planner surfaces current application availability separately from eligibility. Major metropolitan missions checked for 2026 report their Working Holiday intake/calendar closed, so the UI warns users rather than presenting the route as presently bookable.

Application availability is not treated as the same thing as legal eligibility. A country can remain an eligible Working Holiday partner while a mission's quota/calendar is temporarily closed.


## Phase 9 all-market entry guidance

The passport selector now covers every partner/reference market stored in `visa-markets.json`, not only countries with a detailed ruleset.

There are three presentation levels:
1. **Detailed planner** — verified country-specific eligibility, funds, jurisdiction, document checklist and application status.
2. **Eligible partner / status only** — MOFA confirms a Working Holiday arrangement, but JWHV Hub does not yet have enough country-specific evidence for an interactive planner.
3. **No current Working Holiday arrangement** — the site states this explicitly instead of borrowing another country's rules.

The United States is the first enriched non-partner guide. It explains that:
- the U.S. is not on Japan's current Working Holiday partner list;
- visa-free short stays for U.S. citizens do not permit paid activities; and
- paid work or long-term stay generally requires an appropriate visa, commonly with a Certificate of Eligibility obtained through a sponsor in Japan.

Selecting a status-only or non-partner market never falls back to the UK planner in Visa Planner or My Plan.


## Phase 10 EU market expansion wave 2

Ireland, the Netherlands and Italy now have detailed country-specific planners.

- **Ireland:** up to two separate Working Holiday stays; €1,600 with return/onward ticket evidence or €3,200 without; annual ceiling of 800 visas.
- **Netherlands:** one lifetime Working Holiday visa; €1,800 with a return flight or €3,800 with a one-way flight; annual quota of 200. The Embassy's 24 September 2026 notice states that 2026 Working Holiday applications are closed.
- **Italy:** programme operating since 1 April 2026; one lifetime Working Holiday visa; at least €1,800 initial living funds plus a return ticket, or roughly €3,800 without a return ticket. The planner routes northern residents to Milan and other Italian residents to Rome using their different current submission procedures.

Capacity or calendar availability is modeled separately from legal eligibility. A market can remain an eligible partner while the current year's intake is closed or quota-limited.


## Phase 11 EU market expansion wave 3

Spain, Portugal and Sweden now have detailed planners, taking the registry to 12 detailed passport markets.

The shared visa schema now supports:
- **jurisdiction-specific application availability**, so one country's consular offices can show different current quota/calendar states;
- **multi-tier flight/funds rules**, for markets where the required balance depends on round-trip, one-way or no ticket evidence.

Spain is the first market using both features. Current 2026 evidence is mixed by jurisdiction: Madrid reports its allocation exhausted, Barcelona's latest verified notice reported availability, and Las Palmas requires a direct quota re-check. The planner therefore changes the intake notice when the user selects their Spanish consular jurisdiction rather than applying one national status.

Portugal uses the current official €7,000 / €8,000 funds rule depending on whether the return ticket has been acquired. Sweden uses SEK 20,000 with return/onward ticket evidence or SEK 41,000 without.
