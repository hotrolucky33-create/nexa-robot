# Verification contract

Required checks must be `PASS`. `FAIL` and `UNKNOWN` both block `VERIFIED`. A score is diagnostic only. The API is the only path that changes a product to `VERIFIED`; publishing additionally requires that state.

The current deterministic checks cover specification, CAD geometry presence, material provenance, BOM membership, drawing/CAD consistency, axial stress, tolerance ordering, and explicit unavailable simulation/manufacturing/adversarial providers.
