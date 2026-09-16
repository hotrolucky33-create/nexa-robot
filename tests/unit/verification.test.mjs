import test from "node:test";
import assert from "node:assert/strict";
import { verifyProduct } from "../../packages/verification/index.mjs";

test("unknown providers cannot produce a verified product", () => {
  const result = verifyProduct({ name: "incomplete", parts: [], materials: [], bom: [], drawings: [] });
  assert.equal(result.status, "FAIL");
  assert.equal(result.checks.some((item) => item.status === "UNKNOWN"), true);
});
