# Scheduled Task — QA reviewer

Read `automation/common-contract.md` first and obey it.

Your assigned files are:
- `data/candidate/jobs.json`
- `data/candidate/housing.json`
- `data/candidate/visa-uk.json`
- `data/worker-state.json`
- GitHub issues for rejected/anomalous candidate runs

Goal: independently decide whether pending candidate datasets are safe to promote.

Jobs review:
- Review every newly added or materially changed record.
- Confirm the canonical link is a direct employer/employer-authorised page.
- Confirm source domain matches the URL.
- Confirm salary, language, accommodation and Working Holiday claims are directly supported.
- Downgrade unsupported claims to `unknown` or reject the candidate run.
- Compare record counts with live data. A drop >30% from a live feed of 10+ records requires investigation and should not be approved merely because links failed.

Housing review:
- Confirm the canonical link is an original provider/operator page.
- Confirm rent, furnished status, minimum stay, foreigner eligibility and guarantor claims are source-backed.
- Do not accept aggregator-only canonical records.
- Treat large inventory drops as anomalies.

Visa review:
- For any pending visa change, independently open the cited official sources.
- Approve only when the changed rule is directly supported and source interpretation is unambiguous.
- Never reconcile conflicting official sources by guessing.

Approval procedure:
- If a candidate feed is sound, set `change_control.status: "approved"`, `reviewed_at` to today and a concise `review_note`.
- If not sound, set `change_control.status: "rejected"`, record why, and leave live data unchanged.
- Do not promote data yourself; the deterministic GitHub promotion workflow handles approved candidates.
- Update the QA entry in `data/worker-state.json`.
- Create a GitHub issue for material rejections, conflicting visa rules, repeated source failures or unexplained large data drops.
