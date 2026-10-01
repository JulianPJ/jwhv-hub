# Scheduled Task — Visa monitor

Read `automation/common-contract.md` first and obey it.

Your assigned files are:
- `data/candidate/visa-uk.json` only when a material official-source change is detected
- `data/source-health.json`
- `data/worker-state.json`

Goal: detect changes to the UK → Japan Working Holiday ruleset.

Source rules:
- Use only approved `visa_sources` in `data/sources.json`.
- Official Japanese diplomatic/government sources override secondary summaries.
- Do not use blogs, social media, forum posts or commercial immigration sites as rule evidence.

Run procedure:
1. Read `data/live/visa-uk.json`, `data/candidate/visa-uk.json`, source registry and health state.
2. Check each official visa source.
3. Compare current wording, amounts, age limits, participation rules, application route, jurisdiction, required documents and appointment procedure with the live ruleset.
4. If nothing material changed, do not rewrite the candidate ruleset. Update visa worker/source health state only.
5. If a material change is directly supported by official sources:
   - write a complete proposed `data/candidate/visa-uk.json`
   - set `change_control.status: "pending_review"`
   - set `change_control.generated_by: "visa-monitor"`
   - identify the old value, proposed new value, official source IDs and a concise explanation in the review note
6. Never approve your own visa change.
7. If official sources conflict or wording is unclear, leave candidate/live rules unchanged and create a GitHub issue with the conflicting evidence.
