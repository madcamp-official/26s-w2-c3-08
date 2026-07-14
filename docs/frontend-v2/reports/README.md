# Frontend V2 Reports Index

Date: 2026-07-14

Use this index before treating any report status as current. Reports are intentionally append-only snapshots, so older files may preserve FAIL/PARTIAL findings that have since been remediated.

## Current Status Sources

| Report | Use for |
| --- | --- |
| `06-current-integration-status.md` | Current implementation status, latest local/hosted evidence, resolved blockers, and remaining pre-switch risks. |
| `07-production-handoff-checklist.md` | Production env handoff, Qwen/WAN credential inputs, image storage choice, and default switch checklist. |
| `../contracts/migration-gates.md` | Current migration gates and blockers before default switch. |
| `../decisions/product-decisions.md` | Product decisions and approved source-of-truth changes. |
| `../decisions/conflict-register.md` | Active contradictions, migration gaps, and resolved conflicts. |

## Historical Snapshots

These reports document discovery and remediation history. Do not use their FAIL/PARTIAL rows as current blockers without checking the current sources above.

| Reports | Historical role |
| --- | --- |
| `00-*` | Baseline discovery, current architecture at the time, and legacy behavior inventory. |
| `01-five-decision-implementation-audit.md` | Early product-decision implementation audit. |
| `02-*`, `02b-*` | Phase 2A shared contracts and Drawing Engine/browser validation spike records. |
| `03-*` | Pre-remediation parity, visual, accessibility, and legacy removal readiness audits. Several findings are superseded by `06-current-integration-status.md`. |
| `04-legacy-removal-remediation-plan.md` | Remediation plan for blockers that were open at the time. Use it for rationale/dependency history, not as the current blocker list. |
| `05-socket-io-client-dependency-request.md` | Dependency request record for `socket.io-client@4.8.3`; the dependency is now approved and installed. |

## Current External Gates

The remaining pre-switch gates are not code gaps in the current branch:

- real production env values and secrets must be supplied outside Git;
- `npm run check:production-env` must pass with those real env files;
- staging must confirm the full `remote/remote` flow with deployed values;
- product/design review must approve visual evidence or golden baselines.

`madcamp2.pdf` remains a local source artifact and must stay outside commits.
