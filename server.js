import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import QRCode from "qrcode";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });
const app = express();
const port = Number(process.env.PORT || 8787);
const db = new DatabaseSync(path.join(__dirname, "nexa.sqlite"));
const signPayosData = (data) => Object.keys(data).sort()
  .filter((key) => data[key] !== undefined && data[key] !== null && key !== "signature")
  .map((key) => `${key}=${typeof data[key] === "object" ? JSON.stringify(data[key]) : data[key]}`).join("&");

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS robots (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    price_per_day INTEGER NOT NULL,
    rating TEXT NOT NULL,
    location TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    contract_code TEXT NOT NULL UNIQUE,
    robot_id TEXT NOT NULL,
    renter_name TEXT NOT NULL,
    renter_email TEXT NOT NULL,
    address TEXT NOT NULL,
    start_date TEXT NOT NULL,
    days INTEGER NOT NULL,
    total INTEGER NOT NULL,
    status TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'VND',
    payment_provider TEXT,
    payment_reference TEXT,
    paid_at TEXT,
    pickup_receipt TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (robot_id) REFERENCES robots(id)
  );
  CREATE TABLE IF NOT EXISTS ai_logs (
    id TEXT PRIMARY KEY,
    task TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt TEXT NOT NULL,
    response TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS partners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    paypal_email TEXT,
    access_token TEXT NOT NULL UNIQUE,
    available_balance INTEGER NOT NULL DEFAULT 0,
    pending_balance INTEGER NOT NULL DEFAULT 0,
    withdrawn_balance INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS withdrawals (
    id TEXT PRIMARY KEY,
    partner_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    currency TEXT NOT NULL,
    paypal_email TEXT NOT NULL,
    status TEXT NOT NULL,
    paypal_batch_id TEXT,
    paypal_item_id TEXT,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (partner_id) REFERENCES partners(id)
  );
`);
for (const statement of [
  "ALTER TABLE orders ADD COLUMN currency TEXT NOT NULL DEFAULT 'VND'",
  "ALTER TABLE orders ADD COLUMN payment_provider TEXT",
  "ALTER TABLE orders ADD COLUMN payment_reference TEXT",
  "ALTER TABLE orders ADD COLUMN paid_at TEXT",
  "ALTER TABLE orders ADD COLUMN partner_id TEXT"
]) {
  try { db.exec(statement); } catch (error) {
    if (!String(error.message).includes("duplicate column name")) throw error;
  }
}

const robotCount = db.prepare("SELECT COUNT(*) AS count FROM robots").get().count;
if (robotCount === 0) {
  const insert = db.prepare(`INSERT INTO robots
    (id,name,category,description,price_per_day,rating,location)
    VALUES (?,?,?,?,?,?,?)`);
  const seed = [
    ["warehouse-01", "RoboCarry X2", "warehouse", "Đội vận chuyển tự hành cho kho và nhà máy.", 850000, "4.9", "SHENZHEN / CN"],
    ["service-01", "ServiBot S1", "service", "Tương tác khách hàng và giao món tự động.", 1200000, "4.8", "HANOI / VN"],
    ["industrial-01", "ArmFlex 6A", "industrial", "Cánh tay 6 trục cho dây chuyền sản xuất.", 2800000, "5.0", "SHANGHAI / CN"],
    ["event-01", "GuideBot Pro", "event", "Robot lễ tân và tương tác tại sự kiện.", 1600000, "4.7", "HCMC / VN"],
    ["warehouse-02", "CleanRoute C3", "warehouse", "Lau sàn công nghiệp tự động, pin 8 giờ.", 650000, "4.8", "GUANGZHOU / CN"],
    ["service-02", "RoomMate R4", "service", "Giao đồ và phục vụ phòng tự động.", 980000, "4.6", "DANANG / VN"]
  ];
  for (const robot of seed) insert.run(...robot);
}

const allowedOrigins = new Set(
  (process.env.FRONTEND_ORIGIN || "http://localhost:8787,https://nexarobot.cloud,https://hotrolucky33-create.github.io")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);
app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === "null" || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin không được phép."));
  }
}));

app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), (req, res) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: "STRIPE_WEBHOOK_SECRET chưa được cấu hình." });
  const signature = req.headers["stripe-signature"];
  const timestamp = signature?.match(/t=(\d+)/)?.[1];
  const received = signature?.match(/v1=([a-f0-9]+)/)?.[1];
  const signedPayload = `${timestamp}.${req.body.toString()}`;
  const expected = crypto.createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET).update(signedPayload).digest("hex");
  if (!timestamp || !received || received.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return res.status(400).json({ error: "Stripe signature không hợp lệ." });
  const event = JSON.parse(req.body.toString());
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;
    if (orderId) db.prepare("UPDATE orders SET status = ?, payment_reference = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?").run("paid", session.id, orderId);
  }
  res.json({ received: true });
});

app.post("/api/webhooks/payos", express.raw({ type: "application/json" }), (req, res) => {
  if (!process.env.PAYOS_CHECKSUM_KEY) return res.status(503).json({ error: "PAYOS_CHECKSUM_KEY chưa được cấu hình." });
  let payload;
  try {
    payload = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Payload webhook payOS không hợp lệ." });
  }
  const received = payload.signature;
  const expected = crypto.createHmac("sha256", process.env.PAYOS_CHECKSUM_KEY)
    .update(signPayosData(payload.data || {}))
    .digest("hex");
  if (!received || received.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
    return res.status(400).json({ error: "Chữ ký webhook payOS không hợp lệ." });
  }
  const data = payload.data || {};
  const order = db.prepare("SELECT id FROM orders WHERE payment_reference = ?").get(String(data.orderCode || ""));
  if (order && payload.code === "00" && payload.success !== false) {
    db.prepare("UPDATE orders SET status = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ?").run("paid", order.id);
  }
  res.json({ success: true });
});

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const id = () => crypto.randomUUID();
const contractCode = () => `NX-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
const partnerFromRequest = (req) => {
  const token = req.headers["x-partner-token"];
  if (!token) return null;
  return db.prepare("SELECT * FROM partners WHERE access_token = ?").get(String(token));
};

app.post("/api/partners/register", (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const paypalEmail = String(req.body.paypalEmail || "").trim().toLowerCase();
  if (!name || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || (paypalEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(paypalEmail))) {
    return res.status(400).json({ error: "Tên và email hợp lệ là bắt buộc; PayPal email nếu có phải hợp lệ." });
  }
  const existing = db.prepare("SELECT id, access_token FROM partners WHERE email = ?").get(email);
  if (existing) return res.json({ partnerId: existing.id, accessToken: existing.access_token });
  const partnerId = id();
  const accessToken = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO partners (id,name,email,paypal_email,access_token) VALUES (?,?,?,?,?)")
    .run(partnerId, name, email, paypalEmail || null, accessToken);
  res.status(201).json({ partnerId, accessToken });
});

app.get("/api/partners/me", (req, res) => {
  const partner = partnerFromRequest(req);
  if (!partner) return res.status(401).json({ error: "Phiên đối tác không hợp lệ." });
  res.json({
    id: partner.id,
    name: partner.name,
    email: partner.email,
    paypalEmail: partner.paypal_email,
    availableBalanceVnd: partner.available_balance,
    pendingBalanceVnd: partner.pending_balance,
    withdrawnBalanceVnd: partner.withdrawn_balance
  });
});

async function paypalPayout(accessToken, email, amountUsd, withdrawalId) {
  const response = await fetch(`${process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com"}/v1/payments/payouts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender_batch_header: { sender_batch_id: `NEXA-${withdrawalId}`, email_subject: "NEXA partner payout", recipient_type: "EMAIL" },
      items: [{ recipient_type: "EMAIL", amount: { value: amountUsd.toFixed(2), currency: "USD" }, receiver: email, note: "NEXA robot rental partner payout", sender_item_id: withdrawalId }]
    })
  });
  const data = await response.json();
  if (!response.ok || !data.batch_header?.payout_batch_id) {
    throw new Error(data.message || data.name || "PayPal không tạo được payout.");
  }
  return data;
}

app.post("/api/partners/withdraw", async (req, res) => {
  const partner = partnerFromRequest(req);
  if (!partner) return res.status(401).json({ error: "Phiên đối tác không hợp lệ." });
  if (!partner.paypal_email) return res.status(400).json({ error: "Đối tác chưa cấu hình email PayPal." });
  if (process.env.PAYPAL_PAYOUTS_ENABLED !== "true") return res.status(503).json({ error: "PayPal Payouts chưa được bật cho tài khoản NEXA." });
  if (partner.available_balance < 1) return res.status(400).json({ error: "Số dư khả dụng chưa đủ để rút." });
  const amountVnd = partner.available_balance;
  const amountUsd = amountVnd / Number(process.env.USD_VND_RATE || 25000);
  const withdrawalId = id();
  db.exec("BEGIN IMMEDIATE");
  try {
    const current = db.prepare("SELECT available_balance FROM partners WHERE id = ?").get(partner.id);
    if (!current || current.available_balance !== amountVnd) throw new Error("Số dư đã thay đổi, vui lòng thử lại.");
    db.prepare("UPDATE partners SET available_balance = 0, withdrawn_balance = withdrawn_balance + ? WHERE id = ?").run(amountVnd, partner.id);
    db.prepare("INSERT INTO withdrawals (id,partner_id,amount,currency,paypal_email,status) VALUES (?,?,?,?,?,?)")
      .run(withdrawalId, partner.id, amountVnd, "USD", partner.paypal_email, "processing");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    return res.status(409).json({ error: error.message });
  }
  try {
    const token = await paypalAccessToken();
    const data = await paypalPayout(token, partner.paypal_email, amountUsd, withdrawalId);
    db.prepare("UPDATE withdrawals SET status = ?, paypal_batch_id = ? WHERE id = ?")
      .run("submitted", data.batch_header.payout_batch_id, withdrawalId);
    res.json({ withdrawalId, status: "submitted", amountVnd, amountUsd, paypalBatchId: data.batch_header.payout_batch_id });
  } catch (error) {
    db.prepare("UPDATE partners SET available_balance = available_balance + ?, withdrawn_balance = withdrawn_balance - ? WHERE id = ?").run(amountVnd, amountVnd, partner.id);
    db.prepare("UPDATE withdrawals SET status = ?, error = ? WHERE id = ?").run("failed", error.message, withdrawalId);
    res.status(502).json({ error: error.message, withdrawalId });
  }
});

app.post("/api/payments/paypal/capture", async (req, res) => {
  const orderId = String(req.body.orderId || "").trim();
  const paypalOrderId = String(req.body.paypalOrderId || "").trim();
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!order || order.payment_provider !== "paypal" || order.payment_reference !== paypalOrderId) {
    return res.status(400).json({ error: "Đơn hàng hoặc mã PayPal không hợp lệ." });
  }
  if (order.status === "paid") return res.json({ status: "paid", orderId: order.id });
  try {
    const token = await paypalAccessToken();
    const response = await fetch(`${process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com"}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    });
    const data = await response.json();
    if (!response.ok || data.status !== "COMPLETED") {
      return res.status(502).json({ error: "PayPal chưa xác nhận thanh toán.", status: data.status, detail: data.message || data.name });
    }
    db.prepare("UPDATE orders SET status = ?, paid_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending_payment'")
      .run("paid", order.id);
    res.json({ status: "paid", orderId: order.id, paypalOrderId });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.post("/api/webhooks/paypal", express.raw({ type: "application/json" }), async (req, res) => {
  if (!process.env.PAYPAL_WEBHOOK_ID) return res.status(503).json({ error: "PAYPAL_WEBHOOK_ID chưa được cấu hình." });
  let event;
  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Payload PayPal webhook không hợp lệ." });
  }
  const token = await paypalAccessToken().catch(() => null);
  if (!token) return res.status(503).json({ error: "Không xác thực được PayPal." });
  const verifyResponse = await fetch(`${process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com"}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: req.headers["paypal-auth-algo"],
      cert_url: req.headers["paypal-cert-url"],
      transmission_id: req.headers["paypal-transmission-id"],
      transmission_sig: req.headers["paypal-transmission-sig"],
      transmission_time: req.headers["paypal-transmission-time"],
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: event
    })
  });
  const verification = await verifyResponse.json();
  if (!verifyResponse.ok || verification.verification_status !== "SUCCESS") return res.status(400).json({ error: "Chữ ký PayPal webhook không hợp lệ." });
  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED" || event.event_type === "CHECKOUT.ORDER.COMPLETED") {
    const paypalOrderId = event.resource?.supplementary_data?.related_ids?.order_id || event.resource?.id;
    const order = db.prepare("SELECT id FROM orders WHERE payment_reference = ?").get(String(paypalOrderId || ""));
    if (order) db.prepare("UPDATE orders SET status = ?, paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP) WHERE id = ?").run("paid", order.id);
  }
  res.json({ received: true });
});

app.get("/api/health", (_req, res) => res.json({
  ok: true,
  database: "sqlite",
  ai: process.env.OLLAMA_URL || "http://127.0.0.1:11434",
  payment: Boolean(process.env.PAYOS_CLIENT_ID && process.env.PAYOS_API_KEY)
}));

app.get("/api/robots", (_req, res) => {
  res.json(db.prepare("SELECT * FROM robots ORDER BY created_at DESC, name").all());
});

app.get("/api/orders", (_req, res) => {
  res.json(db.prepare(`SELECT orders.*, robots.name AS robot_name
    FROM orders JOIN robots ON robots.id = orders.robot_id
    ORDER BY orders.created_at DESC`).all());
});

app.post("/api/orders", (req, res) => {
  const { robotId, renterName, renterEmail, address, startDate, days } = req.body;
  if (!robotId || !renterName || !renterEmail || !address || !startDate || !Number.isInteger(days) || days < 1) {
    return res.status(400).json({ error: "robotId, renterName, renterEmail, address, startDate và days là bắt buộc." });
  }
  const robot = db.prepare("SELECT * FROM robots WHERE id = ? AND status = 'available'").get(robotId);
  if (!robot) return res.status(404).json({ error: "Robot không tồn tại hoặc không sẵn sàng." });
  const order = { id: id(), contractCode: contractCode(), robotId, renterName, renterEmail, address, startDate, days, total: robot.price_per_day * days, status: "pending_payment" };
  db.prepare(`INSERT INTO orders
    (id,contract_code,robot_id,renter_name,renter_email,address,start_date,days,total,status)
    VALUES (@id,@contractCode,@robotId,@renterName,@renterEmail,@address,@startDate,@days,@total,@status)`).run(order);
  res.status(201).json({ ...order, robot });
});

app.post("/api/orders/:id/terminate", (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Không tìm thấy đơn hàng." });
  if (order.pickup_receipt) return res.status(409).json({ error: "Phiếu thu hồi đã được phát hành." });
  const receipt = `PK-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  db.prepare("UPDATE orders SET status = ?, pickup_receipt = ? WHERE id = ?").run("awaiting_provider_pickup", receipt, order.id);
  res.json({ ...order, status: "awaiting_provider_pickup", pickupReceipt: receipt });
});

app.post("/api/payments/payos", async (req, res) => {
  const { orderId } = req.body;
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!order) return res.status(404).json({ error: "Không tìm thấy đơn hàng." });
  if (!process.env.PAYOS_CLIENT_ID || !process.env.PAYOS_API_KEY || !process.env.PAYOS_CHECKSUM_KEY) {
    return res.status(503).json({ error: "payOS chưa được cấu hình. Hãy điền PAYOS_* trong .env." });
  }
  const payload = {
    orderCode: Number(String(Date.now()).slice(-9)),
    amount: order.total,
    description: `NEXA ${order.contract_code}`.slice(0, 25),
    cancelUrl: process.env.PAYOS_CANCEL_URL,
    returnUrl: process.env.PAYOS_RETURN_URL
  };
  const signatureData = `amount=${payload.amount}&cancelUrl=${payload.cancelUrl}&description=${payload.description}&orderCode=${payload.orderCode}&returnUrl=${payload.returnUrl}`;
  const signature = crypto.createHmac("sha256", process.env.PAYOS_CHECKSUM_KEY).update(signatureData).digest("hex");
  const response = await fetch("https://api-merchant.payos.vn/v2/payment-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-client-id": process.env.PAYOS_CLIENT_ID, "x-api-key": process.env.PAYOS_API_KEY },
    body: JSON.stringify({ ...payload, signature })
  });
  const data = await response.json();
  if (!response.ok || data.code !== "00") return res.status(502).json({ error: "payOS không tạo được payment link.", detail: data });
  db.prepare("UPDATE orders SET payment_provider = ?, payment_reference = ?, currency = ? WHERE id = ?").run("payos", String(payload.orderCode), "VND", order.id);
  const checkoutUrl = data.data.checkoutUrl;
  const qrCode = checkoutUrl ? await QRCode.toDataURL(checkoutUrl, { width: 280, margin: 2, color: { dark: "#5ef5e2", light: "#101820" } }) : data.data.qrCode;
  res.json({ ...data.data, checkoutUrl, qrCode, provider: "payos", currency: "VND" });
});

app.post("/api/payments/stripe", async (req, res) => {
  const { orderId, currency = "usd" } = req.body;
  const order = db.prepare("SELECT orders.*, robots.name AS robot_name FROM orders JOIN robots ON robots.id = orders.robot_id WHERE orders.id = ?").get(orderId);
  if (!order) return res.status(404).json({ error: "Không tìm thấy đơn hàng." });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: "Stripe chưa được cấu hình. Hãy điền STRIPE_SECRET_KEY trong .env." });
  const supported = new Set(["usd", "eur", "gbp", "sgd", "aud", "cad"]);
  if (!supported.has(currency.toLowerCase())) return res.status(400).json({ error: "Loại tiền chưa được cấu hình." });
  const exchangeRate = Number(process.env.USD_VND_RATE || 25000);
  const amount = Math.max(50, Math.round(order.total / exchangeRate * 100));
  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": currency.toLowerCase(),
    "line_items[0][price_data][product_data][name]": `NEXA ${order.robot_name}`,
    "line_items[0][price_data][product_data][description]": `Contract ${order.contract_code}`,
    "line_items[0][price_data][unit_amount]": String(amount),
    "line_items[0][quantity]": "1",
    "metadata[orderId]": order.id,
    success_url: `${process.env.STRIPE_SUCCESS_URL || "http://localhost:8787/payment/success"}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: process.env.STRIPE_CANCEL_URL || "http://localhost:8787/payment/cancel",
    customer_email: order.renter_email
  });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" }, body: params });
  const data = await response.json();
  if (!response.ok || !data.url) return res.status(502).json({ error: "Stripe không tạo được checkout.", detail: data });
  const qrCode = await QRCode.toDataURL(data.url, { width: 280, margin: 2, color: { dark: "#5ef5e2", light: "#101820" } });
  db.prepare("UPDATE orders SET payment_provider = ?, payment_reference = ?, currency = ? WHERE id = ?").run("stripe", data.id, currency.toUpperCase(), order.id);
  res.json({ provider: "stripe", checkoutUrl: data.url, qrCode, currency: currency.toUpperCase(), amount, exchangeRate });
});

async function paypalAccessToken() {
  const credentials = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com"}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials"
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error("PayPal không cấp được access token.");
  return data.access_token;
}

app.post("/api/payments/paypal", async (req, res) => {
  const { orderId, currency = "usd" } = req.body;
  const order = db.prepare("SELECT orders.*, robots.name AS robot_name FROM orders JOIN robots ON robots.id = orders.robot_id WHERE orders.id = ?").get(orderId);
  if (!order) return res.status(404).json({ error: "Không tìm thấy đơn hàng." });
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) return res.status(503).json({ error: "PayPal chưa được cấu hình." });
  const supported = new Set(["usd", "eur", "gbp", "sgd", "aud", "cad"]);
  if (!supported.has(currency.toLowerCase())) return res.status(400).json({ error: "Loại tiền chưa được cấu hình." });
  try {
    const token = await paypalAccessToken();
    const response = await fetch(`${process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com"}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{ reference_id: order.id, description: `NEXA ${order.robot_name}`, amount: { currency_code: currency.toUpperCase(), value: (order.total / Number(process.env.USD_VND_RATE || 25000)).toFixed(2) } }],
        application_context: { brand_name: "NEXA Robot", user_action: "PAY_NOW", return_url: `${process.env.PAYPAL_RETURN_URL || "https://nexarobot.cloud/payment/success"}?orderId=${order.id}`, cancel_url: process.env.PAYPAL_CANCEL_URL || "https://nexarobot.cloud/payment/cancel" }
      })
    });
    const data = await response.json();
    const approval = data.links?.find((link) => link.rel === "approve")?.href;
    if (!response.ok || !data.id || !approval) return res.status(502).json({ error: "PayPal không tạo được checkout.", detail: data });
    const qrCode = await QRCode.toDataURL(approval, { width: 280, margin: 2, color: { dark: "#5ef5e2", light: "#101820" } });
    db.prepare("UPDATE orders SET payment_provider = ?, payment_reference = ?, currency = ? WHERE id = ?").run("paypal", data.id, currency.toUpperCase(), order.id);
    res.json({ provider: "paypal", checkoutUrl: approval, qrCode, currency: currency.toUpperCase() });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

for (const provider of ["alipay", "wechat"]) {
  app.post(`/api/payments/${provider}`, (_req, res) => res.status(503).json({ error: `${provider} cần cấu hình merchant qua PSP hỗ trợ Việt Nam (Airwallex/2C2P hoặc tương đương).` }));
}

app.get("/api/payments/status/:orderId", (req, res) => {
  const order = db.prepare("SELECT id,status,currency,payment_provider,payment_reference,paid_at FROM orders WHERE id = ?").get(req.params.orderId);
  if (!order) return res.status(404).json({ error: "Không tìm thấy đơn hàng." });
  res.json(order);
});

app.post("/api/ai/recommend", async (req, res) => {
  const prompt = String(req.body.prompt || "").trim();
  if (!prompt) return res.status(400).json({ error: "prompt là bắt buộc." });
  const model = process.env.OLLAMA_MODEL || "qwen3:4b";
  const system = "Bạn là trợ lý NEXA. Chỉ đề xuất robot trong danh sách được cung cấp, trả lời ngắn bằng tiếng Việt.";
  const robots = db.prepare("SELECT id,name,category,description,price_per_day,location FROM robots WHERE status = 'available'").all();
  const response = await fetch(`${process.env.OLLAMA_URL || "http://127.0.0.1:11434"}/api/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: false, messages: [{ role: "system", content: system }, { role: "user", content: `Danh sách: ${JSON.stringify(robots)}\nNhu cầu: ${prompt}` }] })
  }).catch(() => null);
  if (!response) return res.status(503).json({ error: "Không kết nối được Ollama local.", model });
  const data = await response.json();
  if (!response.ok || !data.message?.content) return res.status(502).json({ error: "Ollama trả về phản hồi không hợp lệ.", model });
  db.prepare("INSERT INTO ai_logs (id,task,model,prompt,response) VALUES (?,?,?,?,?)").run(id(), "recommend", model, prompt, data.message.content);
  res.json({ model, answer: data.message.content, robots });
});

app.listen(port, () => console.log(`NEXA backend listening at http://localhost:${port}`));
