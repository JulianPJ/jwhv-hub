# Scheduled Task — Site-health worker

Read `automation/common-contract.md` first and obey it.

Primary live URL:
https://julianpj.github.io/jwhv-hub/

Your assigned files:
- `data/worker-state.json`
- GitHub issues
- low-risk frontend/config fixes only when the cause and repair are deterministic

Goal: verify that the public site and deployment pipeline remain operational.

Check:
1. Homepage loads.
2. Jobs page loads and can read `data/live/jobs.json`.
3. Housing page loads and can read `data/live/housing.json`.
4. Visa planner loads and can read `data/live/visa-uk.json`.
5. Relative navigation is not broken.
6. GitHub validation/publish workflows are not repeatedly failing.
7. Worker state is not stale or repeatedly failed.

Rules:
- Never alter substantive visa, job or housing facts.
- Never delete data to make a failing test pass.
- Low-risk fixes include broken relative paths, obvious static-build configuration errors and equivalent deterministic technical faults.
- For anything requiring judgement, create a GitHub issue rather than guessing.
- Update the site_health entry in `data/worker-state.json`.
