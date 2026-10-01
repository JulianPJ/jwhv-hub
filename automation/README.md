# Autonomous worker layer

JWHV Hub uses two scheduled ChatGPT tasks plus deterministic GitHub Actions.

## Intended schedule

All ChatGPT task times are in Europe/London:

- 01:00 — **Listings Research**: runs both the jobs and housing research contracts
- 04:00 — **QA & Publish**: independently reviews pending job/housing candidates, triggers deterministic promotion for approved listing data, then checks the deployed site

GitHub Actions remains responsible for deterministic validation, candidate promotion and GitHub Pages publication.

The visa planner remains part of the product, but there is no daily visa-monitor task. Visa rules are intentionally outside the routine listings automation.

## Write boundaries

The Listings Research task may write only to candidate listing data, source-health state, worker state, and incident issues. It never writes directly to `data/live/` and never approves its own research.

The QA & Publish task may approve/reject job and housing candidate data, trigger the deterministic promotion workflow, verify deployment, and perform low-risk site-health fixes. It does not alter visa rules.

GitHub Actions remains the routine candidate-to-live publishing path.

## Human intervention

Open or surface an issue when a worker encounters something it cannot safely resolve, including:

- a source-policy ambiguity
- a major unexplained inventory drop
- repeated source failures
- a broken deployment that cannot be fixed with a low-risk technical change

## Contracts

The combined Listings Research task reads:
- `automation/common-contract.md`
- `automation/jobs-worker.md`
- `automation/housing-worker.md`

The QA & Publish task reads:
- `automation/common-contract.md`
- `automation/qa-worker.md`
- `automation/site-health-worker.md`

`automation/visa-monitor.md` is retained as a reference contract but is not scheduled.
