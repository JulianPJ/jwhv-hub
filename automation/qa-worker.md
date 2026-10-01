# Scheduled Task — QA reviewer

Read `automation/common-contract.md` first and obey it.

Your assigned files are:
- `data/candidate/jobs.json`
- `data/candidate/housing.json`
- `data/worker-state.json`
- GitHub issues for rejected/anomalous candidate runs

Goal: independently decide whether pending job and housing candidate datasets are safe to promote.

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

Approval procedure:
- If a candidate feed is sound, set `change_control.status: "approved"`, `reviewed_at` to today and a concise `review_note`.
- If it is not sound, set `change_control.status: "rejected"`, record why, and leave live data unchanged.
- Do not edit or review `data/candidate/visa-uk.json`.
- Do not copy candidate data directly into live data; trigger the deterministic GitHub promotion workflow after approval.
- Update the QA entry in `data/worker-state.json`.
- Create a GitHub issue for material rejections, repeated source failures or unexplained large data drops.

After an approved listing feed has been promoted, execute `automation/site-health-worker.md` in the same scheduled run.
