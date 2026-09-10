# NEXA phase 2 local backend

## Chạy trên laptop

1. Cài dependencies: `npm install`
2. Sao chép `.env.example` thành `.env`.
3. Cài Ollama và tải model: `ollama pull qwen3:4b`.
4. Chạy: `npm start`
5. Mở `http://localhost:8787`. Nếu dùng frontend GitHub Pages, backend vẫn phải chạy trên laptop và frontend sẽ gọi `http://localhost:8787` mặc định. Có thể đổi bằng `window.NEXA_API_URL` trước khi tải `app.js` khi backend được đưa lên máy chủ khác.

Backend lưu dữ liệu trong `nexa.sqlite` trên laptop. Không đưa `.env` hoặc file SQLite lên GitHub.

## API

- `GET /api/health`
- `GET /api/robots`
- `GET /api/orders`
- `POST /api/orders`
- `POST /api/orders/:id/terminate`
- `POST /api/payments/payos`
- `POST /api/payments/paypal`
- `POST /api/payments/alipay`
- `POST /api/payments/wechat`
- `GET /api/payments/status/:orderId`
- `POST /api/webhooks/payos`
- `POST /api/ai/recommend`

payOS dùng cho VND. PayPal dùng Checkout quốc tế và yêu cầu `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, cùng tài khoản PayPal merchant được duyệt. Alipay và WeChat Pay chỉ bật sau khi có merchant account qua PSP hỗ trợ merchant Việt Nam (ví dụ Airwallex/2C2P); không thể tự tạo payment link thật chỉ bằng tên thương hiệu.

## Kích hoạt thanh toán thật

1. Tạo file `D:\thuerobot\.env` từ `.env.example`; không gửi file này lên GitHub.
2. Trong payOS, đặt webhook URL công khai là `/api/webhooks/payos`.
3. Trong PayPal Developer, tạo App, lấy Client ID/Secret và chuyển `PAYPAL_BASE_URL` sang `https://api-m.paypal.com` khi live.
4. Đăng ký merchant Alipay/WeChat qua PSP, sau đó nối adapter theo API và webhook của PSP.
5. Dùng URL HTTPS công khai cho các URL return/cancel. Không dùng `localhost` cho thanh toán thật.
6. PayPal Payouts chỉ chạy khi tài khoản được PayPal phê duyệt và `PAYPAL_PAYOUTS_ENABLED=true`; đối tác đăng ký ví bằng email PayPal rồi tự bấm rút tiền.

## Trạng thái triển khai

- Backend SQLite, tạo đơn, chấm dứt hợp đồng và phiếu thu hồi: hoàn tất.
- Tạo payment link payOS và adapter PayPal Checkout + QR: đã tích hợp; cần PayPal Client ID/Secret để chạy thật.
- PayPal capture khi khách quay lại và endpoint webhook đã tích hợp; cần cấu hình `PAYPAL_WEBHOOK_ID` trong `.env`.
- Ví đối tác và yêu cầu rút PayPal đã tích hợp; giữ `PAYPAL_PAYOUTS_ENABLED=false` cho tới khi PayPal phê duyệt Payouts.
- Alipay/WeChat: đã có endpoint bảo vệ, chờ merchant PSP được duyệt; không giả lập thanh toán.
- Frontend GitHub Pages: chỉ là giao diện tĩnh; thanh toán thật không hoạt động cho khách bên ngoài nếu API backend vẫn chỉ chạy ở `localhost`.
