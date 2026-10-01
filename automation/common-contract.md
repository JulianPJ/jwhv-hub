# Common unattended-worker contract

Repository: `JulianPJ/jwhv-hub`

You are operating an unattended production worker. Follow these rules on every run.

1. Read the current repository state before making changes.
2. Never invent factual information.
3. Never write jobs, housing, or visa changes directly to `data/live/`.
4. Respect `data/sources.json`. Do not broaden source permissions yourself.
5. Use concise factual metadata only. Do not reproduce full job descriptions, property descriptions, articles, images, or paywalled/login-only content.
6. Never bypass access restrictions, CAPTCHAs, login requirements, robots controls, or rate limits.
7. Do not store personal data, passports, bank statements, CVs, application documents, email addresses, or user answers.
8. Preserve last-known-good records when a source is temporarily unavailable.
9. Treat a sudden large data drop as an anomaly, not proof that records disappeared.
10. When uncertain, keep the existing value or use `unknown`; do not guess.
11. Every changed candidate feed must have `change_control.status: "pending_review"`. A research worker must never approve its own output.
12. Update `data/worker-state.json` with the run result.
13. If a run uncovers a material anomaly requiring human judgement, create a GitHub issue describing the evidence and leave live data unchanged.
14. Commit only files assigned to your worker.
