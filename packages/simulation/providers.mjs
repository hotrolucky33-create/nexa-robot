export class ExternalSolverProvider {
  constructor({ executable = null, name = "external-solver" } = {}) { this.executable = executable; this.name = name; }
  async runStressAnalysis() {
    return { status: "NOT_AVAILABLE", solver: this.name, detail: this.executable ? "Configured executable adapter requires solver-specific implementation." : "No solver executable configured." };
  }
}
