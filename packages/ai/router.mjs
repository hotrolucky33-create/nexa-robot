export class AIProviderRouter {
  constructor({ providers = {} } = {}) { this.providers = providers; }
  route(taskType) {
    const provider = this.providers[taskType] || this.providers.reasoning;
    if (!provider) return { status: "NOT_AVAILABLE", taskType, detail: "No local or cloud AI provider is configured." };
    return { status: "AVAILABLE", taskType, provider };
  }
}
