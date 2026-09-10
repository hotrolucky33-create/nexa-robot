import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 8787);
const db = new DatabaseSync(path.join(__dirname, "nexa.sqlite"));

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
`);

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

app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(",") || true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const id = () => crypto.randomUUID();
const contractCode = () => `NX-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

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
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(order.id, order.contractCode, order.robotId, order.renterName, order.renterEmail, order.address, order.startDate, order.days, order.total, order.status);
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
  res.json(data.data);
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
