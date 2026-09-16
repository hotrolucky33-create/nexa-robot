# Project analysis

## Starting point

The repository contained a single Express/SQLite robot-rental application with payment credentials and a static frontend. It did not have product versioning, deterministic engineering verification, a job model, or a test suite.

The machine has Node.js 26 and Python 3.14. Docker and FreeCAD are not installed. The new MVP therefore uses Node's built-in SQLite support and deterministic local engineering rules. CAD and simulation adapters report `NOT_AVAILABLE` until a real solver is configured; they never manufacture a passing result.

## Replacement decision

The old robot-rental entrypoints are replaced by a modular MVP named **Verified Engineering Marketplace**. Git history is retained, but old runtime files, local database files, and payment secrets are not part of the new application.

## MVP boundary

The first product is a low-risk educational mechanical workshop press package. It demonstrates specification, parts/BOM, deterministic shaft stress calculation, tolerance analysis, cross-document validation, verification, immutable verified versions, marketplace listing, order entitlement, and audit evidence.

Pressure vessels, dangerous machinery, safety-critical devices, and industrial release remain blocked behind human engineering review.
