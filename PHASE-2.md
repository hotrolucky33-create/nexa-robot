# NEXA phase 2 local backend

## Chạy trên laptop

1. Cài dependencies: `npm install`
2. Sao chép `.env.example` thành `.env`.
3. Cài Ollama và tải model: `ollama pull qwen3:4b`.
4. Chạy: `npm start`
5. Mở `http://localhost:8787`.

Backend lưu dữ liệu trong `nexa.sqlite` trên laptop. Không đưa `.env` hoặc file SQLite lên GitHub.

## API

- `GET /api/health`
- `GET /api/robots`
- `GET /api/orders`
- `POST /api/orders`
- `POST /api/orders/:id/terminate`
- `POST /api/payments/payos`
- `POST /api/ai/recommend`

payOS chỉ được bật khi khai báo đầy đủ `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`. API key chỉ nằm ở backend.
