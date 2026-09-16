# Phase 3 audit

## Deployment

The repository is now configured to deploy `apps/web` through GitHub Pages on every push to `main`, with `nexarobot.cloud` restored as the custom domain. The Node API is not deployable on GitHub Pages because Pages is static hosting; it needs a Node-capable host and the `DATABASE_PATH`, `FRONTEND_ORIGIN`, and payment/provider secrets.

## Capability status

| Capability | Status | Evidence |
|---|---|---|
| Deterministic calculations | REAL | `packages/engineering-engine` and tests |
| Analytical CAD validation | REAL/PARTIAL | `packages/cad/engine.mjs`; not a BREP kernel |
| Artifact ZIP and hashes | REAL | `packages/artifacts/manager.mjs` |
| Local API | REAL | `apps/api/server.mjs` |
| Public web deployment | CONFIGURED | `.github/workflows/pages.yml` |
| Public API deployment | BLOCKED | No Node hosting credentials/service configured |
| FreeCAD/OpenCASCADE | NOT_AVAILABLE | Not installed on current machine |
| FEA/thermal/motion | NOT_AVAILABLE | No solver executable configured |
| Production payment | NOT_AVAILABLE | No production provider credentials in repository |

No `NOT_AVAILABLE`, `UNKNOWN`, or mock result is promoted to `PASS`.
