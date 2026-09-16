import assert from "node:assert/strict";
import { verifyProduct } from "../packages/verification/index.mjs";

const valid = {
  name: "Workshop Press",
  parts: [{ id: "SHAFT-001", materialId: "C45", geometry: { diameterMm: 20 }, loadN: 1000, minimumFactorOfSafety: 2, tolerance: { minMm: 19.98, maxMm: 20.02 } }],
  materials: [{ id: "C45", status: "VERIFIED", yieldStrengthMpa: 300 }],
  bom: [{ partId: "SHAFT-001" }],
  drawings: [{ partId: "SHAFT-001", diameterMm: 20 }]
};
assert.equal(verifyProduct(valid).status, "FAIL", "Unavailable providers must block verification");
assert.equal(verifyProduct({ ...valid, drawings: [{ partId: "SHAFT-001", diameterMm: 22 }] }).checks.find((item) => item.id === "DRAW-001").status, "FAIL");
assert.equal(verifyProduct({ ...valid, materials: [] }).checks.find((item) => item.id === "MAT-001").status, "UNKNOWN");
console.log("Self-test passed: deterministic failures are blocked and evidence checks execute.");
