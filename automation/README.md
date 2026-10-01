# Autonomous worker layer

This directory contains the exact operating contracts for the five scheduled workers that maintain JWHV Hub.

## Intended schedule

All times should be in Europe/London:

- 01:00 — Jobs worker
- 02:00 — Housing worker
- 03:00 — Visa monitor
- 04:00 — QA reviewer
- 05:15 UTC — GitHub Actions promotes any QA-approved candidate data
- 06:00 — Site-health worker

The GitHub promotion job is deterministic. It does not decide whether candidate data is trustworthy; the QA worker does that first by setting `change_control.status` to `approved`.

## Write boundaries

Research workers may write only to candidate data, source-health state, worker state, and incident issues. They never write directly to `data/live/`.

QA may approve/reject candidate data but does not invent replacement facts.

GitHub Actions is the only routine path from candidate data to live data.

## Human intervention

An issue should be opened when a worker encounters something it cannot safely resolve, including:

- a source-policy ambiguity
- a major inventory drop
- repeated source failures
- a material visa-rule change with conflicting official sources
- a broken deployment that cannot be fixed with a low-risk technical change
