# Phase 2 implementation plan

## Current baseline

The repository already has a working Express/SQLite MVP, a deterministic verification gate, a static marketplace, and tests. The machine has Node.js 26 and Python 3.14, but no FreeCAD, CalculiX, Code_Aster, Elmer, Docker, PostgreSQL server, Redis server, or object-storage credentials.

## Execution order

1. Add provider contracts and a local parametric test-press model.
2. Add deterministic geometry, assembly, calculation, tolerance, manufacturing, drawing, BOM, and cross-document validators.
3. Add artifact packaging with manifest and SHA-256 integrity.
4. Add local database, queue, storage, authentication, and payment providers as explicit adapters.
5. Add factory orchestration, failure reports, revision limits, adversarial and mutation results.
6. Wire API verification to the engine result without ever converting `UNKNOWN`/`NOT_AVAILABLE` to `PASS`.
7. Add unit, integration, negative, and acceptance tests.
8. Run build, tests, and a system capability report.

## Honest capability boundary

The local analytical geometry provider is a deterministic parametric model used for data validation and test orchestration; it is not a substitute for a BREP CAD kernel. The FreeCAD and external solver adapters remain `NOT_AVAILABLE` until the executables are installed and version-pinned. Therefore the acceptance product remains `NOT_VERIFIED` when real CAD/FEA evidence is required.
