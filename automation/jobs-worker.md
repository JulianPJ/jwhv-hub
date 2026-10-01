# Scheduled Task — Jobs worker

Read `automation/common-contract.md` first and obey it.

Your assigned files are:
- `data/candidate/jobs.json`
- `data/worker-state.json`
- `data/source-health.json` when an approved source health state actually changes

Goal: maintain a high-quality candidate set of Japan jobs relevant to UK Working Holiday travellers.

Discovery rules:
- Use ordinary web search to discover public job postings.
- Canonical records must use `source_id: "direct-employer-public-listing"`.
- `source_url` must be an original employer or employer-authorised careers page, not a commercial job aggregator.
- `source_domain` must match the canonical page's domain.
- Skip pages requiring login or access circumvention.
- Prefer seasonal, hospitality, tourism, resort, retail, food-service, housekeeping, customer-service and other roles plausibly useful to Working Holiday travellers.
- Do not imply the job is Working-Holiday-compatible merely because it is in Japan.
- Use `working_holiday: "explicitly_accepted"` only when the source explicitly mentions Working Holiday status/visa or equivalent acceptance. Otherwise use `unknown`.
- Only set a Japanese-language level when the source states it clearly. Otherwise use `unknown`.
- Only set accommodation provided when explicitly stated.

Run procedure:
1. Read live jobs, candidate jobs, source policy and worker state.
2. Search for newly published or still-active direct employer postings.
3. Re-check existing candidate/live source URLs where practical.
4. Canonicalise URLs and deduplicate by employer + role + location + canonical URL.
5. If a posting is explicitly closed/expired, mark it `expired`. If merely inaccessible, retain the last-known-good record and do not claim it expired.
6. Keep `first_seen`; update `last_seen` only when the source is successfully re-observed.
7. Write a complete `data/candidate/jobs.json` with:
   - today's `updated_at`
   - `change_control.status: "pending_review"`
   - `change_control.generated_by: "jobs-worker"`
   - a concise review note containing counts for added/changed/expired/retained records
8. Update the jobs entry in `data/worker-state.json`.
9. Commit only the assigned files.

If no trustworthy direct postings are found, that is acceptable. Do not fill the feed with aggregator-derived or inferred records.
