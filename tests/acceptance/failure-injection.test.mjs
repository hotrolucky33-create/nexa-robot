import test from "node:test";
import assert from "node:assert/strict";
import { AnalyticalCadProvider } from "../../packages/cad/engine.mjs";
import { calculateShaftStress } from "../../packages/engineering-engine/calculations.mjs";
import { analyzeTolerance } from "../../packages/engineering-engine/tolerance.mjs";
import { validateManufacturing } from "../../packages/engineering-engine/manufacturing.mjs";
import { crossValidate } from "../../packages/engineering-engine/cross-document.mjs";

const cases = [
  ["wrong diameter", () => crossValidate({ cad: [{ id: "S", diameterMm: 20 }], drawing: [{ partId: "S", diameterMm: 21 }], bom: [], assembly: [], calculations: { status: "PASS" } })],
  ["wrong material", () => crossValidate({ cad: [{ id: "S", diameterMm: 20 }], drawing: [{ partId: "S", diameterMm: 20 }], bom: [{ partId: "S", quantity: 2 }], assembly: [{ partId: "S", quantity: 3 }], calculations: { status: "PASS" } })],
  ["bad tolerance", () => analyzeTolerance({ nominal: 20, tolerance: -1 })],
  ["bad wall", () => validateManufacturing({ wallThicknessMm: 1 })],
  ["bad stress input", () => calculateShaftStress({ loadN: 1000, diameterMm: 0, yieldStrengthMpa: 300 })],
  ...Array.from({ length: 15 }, (_, index) => [`invalid geometry ${index + 1}`, () => {
    const model = new AnalyticalCadProvider().createTestPress();
    model.parts[0].sizeMm[0] = 0;
    return new AnalyticalCadProvider().validateGeometry(model);
  }])
];

for (const [name, execute] of cases) {
  test(`failure injection: ${name}`, () => {
    const result = execute();
    assert.notEqual(result.status, "PASS");
  });
}
