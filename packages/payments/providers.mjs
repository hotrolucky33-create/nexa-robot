export class MockPaymentProvider {
  constructor() { this.payments = new Map(); }
  async createCheckout({ orderId, amount, currency }) {
    const payment = { id: `mock_${orderId}`, orderId, amount, currency, status: "PENDING" };
    this.payments.set(payment.id, payment);
    return payment;
  }
  async verifyPayment(paymentId) {
    const payment = this.payments.get(paymentId);
    if (!payment) return { status: "UNKNOWN" };
    return { ...payment, status: payment.status };
  }
  markPaid(paymentId) { const payment = this.payments.get(paymentId); if (!payment) throw new Error("PAYMENT_NOT_FOUND"); payment.status = "PAID"; return payment; }
  async refund(paymentId) { const payment = this.payments.get(paymentId); if (!payment) return { status: "UNKNOWN" }; payment.status = "REFUNDED"; return payment; }
}

export class RealPaymentProvider {
  async createCheckout() { return { status: "NOT_AVAILABLE", detail: "Configure a production payment adapter." }; }
  async verifyPayment() { return { status: "NOT_AVAILABLE", detail: "Configure a production payment adapter." }; }
  async refund() { return { status: "NOT_AVAILABLE", detail: "Configure a production payment adapter." }; }
}
