import test from "node:test";
import assert from "node:assert/strict";
import { AnalyticalCadProvider } from "../../packages/cad/engine.mjs";
import { calculateShaftStress } from "../../packages/engineering-engine/calculations.mjs";
import { analyzeClearance } from "../../packages/engineering-engine/tolerance.mjs";
import { LocalQueue } from "../../packages/queue/local.mjs";
import { LocalAuthProvider } from "../../packages/auth/local.mjs";
import { MockPaymentProvider } from "../../packages/payments/providers.mjs";

test("parametric CAD catches invalid geometry", () => {
  const cad = new AnalyticalCadProvider();
  const model = cad.createTestPress();
  assert.equal(cad.validateGeometry(model).status, "PASS");
  model.parts[0].sizeMm[0] = 0;
  assert.equal(cad.validateGeometry(model).status, "FAIL");
});

test("assembly validator detects intentional collision", () => {
  const cad = new AnalyticalCadProvider();
  const model = { parts: [
    { id: "A", kind: "box", originMm: [0, 0, 0], sizeMm: [10, 10, 10] },
    { id: "B", kind: "box", originMm: [5, 5, 5], sizeMm: [10, 10, 10] }
  ] };
  assert.equal(cad.validateAssembly(model).status, "FAIL");
});

test("shaft calculation matches reference result", () => {
  const result = calculateShaftStress({ loadN: 1000, diameterMm: 20, yieldStrengthMpa: 300 });
  assert.equal(Number(result.result.stressMpa.toFixed(6)), Number((1000 / (Math.PI * 100)).toFixed(6)));
  assert.equal(result.status, "PASS");
});

test("worst-case clearance detects interference", () => {
  assert.equal(analyzeClearance({ shaft: { nominal: 20, tolerance: 0.02 }, bearing: { nominal: 20, tolerance: 0.01 } }).status, "FAIL");
});

test("local queue is idempotent and observable", () => {
  const queue = new LocalQueue();
  assert.equal(queue.enqueue({ id: "job-1", type: "RUN_CALCULATION" }).status, "QUEUED");
  assert.equal(queue.enqueue({ id: "job-1", type: "RUN_CALCULATION" }).status, "IDEMPOTENT");
  assert.equal(queue.complete("job-1").status, "COMPLETED");
});

test("auth hashes passwords and rejects short passwords", () => {
  const auth = new LocalAuthProvider();
  assert.throws(() => auth.register("user@example.com", "short"), /12/);
  auth.register("user@example.com", "correct-horse-battery");
  const login = auth.login("user@example.com", "correct-horse-battery");
  assert.equal(auth.authenticate(login.token).email, "user@example.com");
  assert.throws(() => auth.login("user@example.com", "wrong"), /INVALID/);
});

test("payment is backend verified, not frontend asserted", async () => {
  const payments = new MockPaymentProvider();
  const checkout = await payments.createCheckout({ orderId: "order-1", amount: 100, currency: "USD" });
  assert.equal((await payments.verifyPayment(checkout.id)).status, "PENDING");
  payments.markPaid(checkout.id);
  assert.equal((await payments.verifyPayment(checkout.id)).status, "PAID");
});
