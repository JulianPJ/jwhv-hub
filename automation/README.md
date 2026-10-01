# Autonomous worker layer

JWHV Hub uses two scheduled ChatGPT tasks plus deterministic GitHub Actions.

## Intended schedule

All ChatGPT task times are in Europe/London:

- Hourly at :18 — **Listings Research**: read-only broad jobs/housing discovery and source-family sweeps
- Hourly at :18 — **QA & Site Audit**: read-only candidate/live audit, source verification, deployment/site-health checks and expansion research

GitHub Actions remains responsible for deterministic validation, candidate promotion and GitHub Pages publication.

The visa planner remains part of the product, but there is no daily visa-monitor task. Visa rules are intentionally outside the routine listings automation.

## Write boundaries

The two ChatGPT Scheduled Tasks currently run in READ-ONLY MODE because unattended GitHub mutations were blocked by the execution safety layer. They research and audit; deterministic GitHub-native workflows remain the correct path for routine writes, validation, promotion and deployment.

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
