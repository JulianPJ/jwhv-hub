# Scheduled Task — Visa monitor

Read `automation/common-contract.md` first and obey it.

This contract is retained for future activation; the current production Scheduled Tasks are listings research and QA/site audit.

Your assigned files are:
- `data/candidate/visa-markets.json` only when MOFA's partner-country/region list materially changes
- `data/candidate/visa-*.json` only for detailed markets whose official rules materially change
- `data/source-health.json`
- `data/worker-state.json`

Goal: detect material changes to Japan Working Holiday eligibility and country-specific application rules without writing directly to live data.

Current detailed rulesets:
- United Kingdom — `visa-uk.json`
- Australia — `visa-au.json`
- Germany — `visa-de.json`

Source rules:
- Use only approved `visa_sources` in `data/sources.json`.
- MOFA's Working Holiday page is authoritative for the partner-country/region registry and programme-wide rules.
- Country-specific Japanese embassy/consulate sources are authoritative for local application procedures, funds, documents, jurisdiction and appointment rules.
- Do not use blogs, social media, forum posts or commercial immigration sites as rule evidence.
- Do not treat the EU as one visa market. Eligibility and procedures are passport-country specific.
- A country absent from MOFA's current partner list (for example the United States as of 1 April 2026) must not be represented as Working Holiday eligible.

Run procedure:
1. Read `data/live/visa-markets.json`, its candidate counterpart, every detailed `data/live/visa-*.json` ruleset, corresponding candidates, source registry and health state.
2. Check MOFA for partner-country/region changes.
3. Check each detailed market's official Japanese diplomatic sources.
4. Compare current wording, age limits, participation limits, funds, application route, jurisdiction, documents and appointment procedure with live data.
5. If nothing material changed, leave candidate rulesets unchanged and update only permitted health/worker state.
6. If MOFA's partner registry changed, write a complete proposed `data/candidate/visa-markets.json` with `change_control.status: "pending_review"` and precise evidence.
7. If a detailed country's rules changed, write that country's complete candidate ruleset with `change_control.status: "pending_review"`, identify old/new values and official source IDs in the review note.
8. Never approve your own visa change and never write directly to `data/live/`.
9. If official sources conflict or wording is unclear, preserve last-known-good data and surface the conflict rather than guessing.
