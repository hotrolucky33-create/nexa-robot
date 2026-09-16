import test from "node:test";
import assert from "node:assert/strict";
import { AnalyticalCadProvider } from "../../packages/cad/engine.mjs";
import { ExternalSolverProvider } from "../../packages/simulation/providers.mjs";

test("TEST-PRESS-001 remains not verified without a real solver", async () => {
  const cad = new AnalyticalCadProvider();
  const model = cad.createTestPress();
  assert.equal(model.id, "TEST-PRESS-001");
  assert.equal(cad.validateGeometry(model).status, "PASS");
  assert.equal((await new ExternalSolverProvider().runStressAnalysis()).status, "NOT_AVAILABLE");
});
