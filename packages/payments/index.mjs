export class PaymentProvider {
  async createCheckout() {
    return { status: "NOT_AVAILABLE", message: "Payment provider credentials are not configured." };
  }
}
