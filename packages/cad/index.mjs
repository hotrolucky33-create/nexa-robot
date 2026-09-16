export class CadProvider {
  constructor(name = "unconfigured") { this.name = name; }
  async generate() {
    return { status: "NOT_AVAILABLE", provider: this.name, message: "Configure a real parametric CAD kernel before release." };
  }
}
