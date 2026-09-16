import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import dotenv from "dotenv";
import { verifyProduct } from "../../packages/verification/index.mjs";
import { MockPaymentProvider, RealPaymentProvider } from "../../packages/payments/providers.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(root, ".env") });
const databasePath = path.resolve(root, process.env.DATABASE_PATH || "./data/engineering.sqlite");
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
const app = express();
const port = Number(process.env.PORT || 8787);
const db = new DatabaseSync(databasePath);
const paymentProvider = process.env.PAYMENT_PROVIDER === "mock" ? new MockPaymentProvider() : new RealPaymentProvider();
db.exec(`
  PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    status TEXT NOT NULL, price_cents INTEGER NOT NULL, currency TEXT NOT NULL,
    specification_json TEXT NOT NULL, version TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS verification_runs (
    id TEXT PRIMARY KEY, product_id TEXT NOT NULL, status TEXT NOT NULL,
    checks_json TEXT NOT NULL, evidence_json TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, product_id TEXT NOT NULL, email TEXT NOT NULL,
    status TEXT NOT NULL, entitlement_token TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY, action TEXT NOT NULL, entity_id TEXT NOT NULL,
    payload_json TEXT NOT NULL, created_at TEXT NOT NULL
  );
`);

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:8787" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(root, "apps/web")));

const now = () => new Date().toISOString();
const audit = (action, entityId, payload) => db.prepare(
  "INSERT INTO audit_logs VALUES (?, ?, ?, ?, ?)"
).run(randomUUID(), action, entityId, JSON.stringify(payload), now());
const readProduct = (row) => row && ({ ...row, specification: JSON.parse(row.specification_json) });

app.get("/health", (_req, res) => res.json({ status: "ok", service: "engineering-marketplace" }));
app.get("/ready", (_req, res) => res.json({ status: "ready", database: "connected" }));
app.get("/api/products", (_req, res) => {
  const rows = db.prepare("SELECT * FROM products WHERE status='PUBLISHED' ORDER BY created_at DESC").all();
  res.json(rows.map(readProduct));
});
app.get("/api/products/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM products WHERE id=? OR slug=?").get(req.params.id, req.params.id);
  if (!row) return res.status(404).json({ error: "PRODUCT_NOT_FOUND" });
  const run = db.prepare("SELECT * FROM verification_runs WHERE product_id=? ORDER BY created_at DESC LIMIT 1").get(row.id);
  res.json({ ...readProduct(row), verification: run ? { ...run, checks: JSON.parse(run.checks_json), evidence: JSON.parse(run.evidence_json) } : null });
});
app.post("/api/products", (req, res) => {
  const { name, slug, specification, priceCents = 0, currency = "USD" } = req.body || {};
  if (!name || !slug || !specification) return res.status(400).json({ error: "NAME_SLUG_SPECIFICATION_REQUIRED" });
  const id = randomUUID();
  try {
    db.prepare("INSERT INTO products VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, 'v1.0.0', ?)").run(
      id, slug, name, Number(priceCents), currency, JSON.stringify(specification), now()
    );
  } catch (error) {
    return res.status(409).json({ error: "SLUG_ALREADY_EXISTS", detail: error.message });
  }
  audit("PRODUCT_CREATED", id, { name, slug });
  res.status(201).json(readProduct(db.prepare("SELECT * FROM products WHERE id=?").get(id)));
});
app.post("/api/products/:id/verify", (req, res) => {
  const row = db.prepare("SELECT * FROM products WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "PRODUCT_NOT_FOUND" });
  const result = verifyProduct(JSON.parse(row.specification_json));
  const status = result.status === "PASS" ? "VERIFIED" : "FAILED";
  db.prepare("UPDATE products SET status=? WHERE id=?").run(status, row.id);
  db.prepare("INSERT INTO verification_runs VALUES (?, ?, ?, ?, ?, ?)").run(
    randomUUID(), row.id, result.status, JSON.stringify(result.checks), JSON.stringify(result.evidence), now()
  );
  audit("PRODUCT_VERIFIED", row.id, { status, checkCount: result.checks.length });
  res.json({ product: readProduct(db.prepare("SELECT * FROM products WHERE id=?").get(row.id)), verification: result });
});
app.post("/api/products/:id/publish", (req, res) => {
  const row = db.prepare("SELECT * FROM products WHERE id=?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "PRODUCT_NOT_FOUND" });
  if (row.status !== "VERIFIED") return res.status(409).json({ error: "ONLY_VERIFIED_PRODUCTS_CAN_BE_PUBLISHED", status: row.status });
  db.prepare("UPDATE products SET status='PUBLISHED' WHERE id=?").run(row.id);
  audit("PRODUCT_PUBLISHED", row.id, {});
  res.json(readProduct(db.prepare("SELECT * FROM products WHERE id=?").get(row.id)));
});
app.post("/api/orders", async (req, res) => {
  const { productId, email } = req.body || {};
  const product = db.prepare("SELECT * FROM products WHERE id=? AND status='PUBLISHED'").get(productId);
  if (!product || !email) return res.status(400).json({ error: "PUBLISHED_PRODUCT_AND_EMAIL_REQUIRED" });
  const order = { id: randomUUID(), productId, email, status: "PAYMENT_PENDING", entitlementToken: randomUUID() };
  const checkout = await paymentProvider.createCheckout({ orderId: order.id, amount: product.price_cents, currency: product.currency });
  if (checkout.status === "NOT_AVAILABLE") return res.status(503).json({ error: "PAYMENT_PROVIDER_NOT_AVAILABLE", detail: checkout.detail });
  db.prepare("INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?)").run(order.id, productId, email, order.status, order.entitlementToken, now());
  audit("ORDER_CREATED", order.id, { productId, email, paymentId: checkout.id });
  res.status(201).json({ id: order.id, status: order.status, payment: checkout });
});
app.post("/api/orders/:id/verify-payment", async (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id=?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "ORDER_NOT_FOUND" });
  const payment = await paymentProvider.verifyPayment(req.body?.paymentId);
  if (payment.status !== "PAID") return res.status(409).json({ error: "PAYMENT_NOT_CONFIRMED", status: payment.status });
  db.prepare("UPDATE orders SET status='PAID' WHERE id=?").run(order.id);
  audit("PAYMENT_VERIFIED", order.id, { paymentId: payment.id });
  res.json({ id: order.id, status: "PAID", entitlementToken: order.entitlement_token });
});
app.get("/api/orders/:id/download", (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id=? AND entitlement_token=?").get(req.params.id, req.query.token);
  if (!order) return res.status(403).json({ error: "INVALID_ENTITLEMENT" });
  res.json({ package: "not_generated", status: "NOT_AVAILABLE", message: "A signed package is issued only after artifact generation." });
});

app.listen(port, () => console.log(`Engineering marketplace listening on http://localhost:${port}`));
