# Scheduled Task — Housing worker

Read `automation/common-contract.md` first and obey it.

Your assigned files are:
- `data/candidate/housing.json`
- `data/worker-state.json`
- `data/source-health.json` when an approved source health state actually changes

Goal: maintain candidate housing useful to temporary residents on a Japan Working Holiday.

Discovery rules:
- Use ordinary web search to discover public housing-provider/operator pages.
- Canonical records must use `source_id: "direct-housing-provider-public-listing"`.
- `source_url` must be an original property operator/provider page, not a third-party aggregator.
- `source_domain` must match the canonical page's domain.
- Prefer furnished share houses, monthly rentals, guest houses, coliving and other short/medium-term accommodation suitable for stays of roughly 1–12 months.
- Never infer `foreigner_eligibility`, guarantor requirements, furnished status, minimum stay, fees, availability or rent when the provider does not state them.
- When explicitly stated, record `monthly_rent_jpy` as the total recurring monthly amount used for sorting, `available_from` as YYYY-MM-DD, and a concise `upfront_fee_display` for mandatory one-time fees.
- Use `foreigner_eligibility: "explicitly_accepted"` only when the provider explicitly supports foreign/international residents or Working Holiday/long-stay foreign customers. Otherwise use `unknown`.

Run procedure:
1. Read live housing, candidate housing, source policy and worker state.
2. Discover and re-check original provider pages.
3. Deduplicate by provider/property + location + canonical URL.
4. Preserve `first_seen`; update `last_seen` only when re-observed.
5. Mark a record expired only when the provider clearly shows it is no longer available/valid. Temporary access failure is not expiry.
6. Write a complete `data/candidate/housing.json` with `change_control.status: "pending_review"`, `generated_by: "housing-worker"`, and counts of additions/changes/expiries/retained records.
7. Update the housing entry in `data/worker-state.json`.
8. Commit only the assigned files.

Do not scrape or bulk-copy commercial housing aggregators.
