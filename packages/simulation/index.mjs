export class SimulationProvider {
  async runStressAnalysis() {
    return { status: "NOT_AVAILABLE", message: "No verified simulation solver is configured." };
  }
  async runThermalAnalysis() {
    return { status: "NOT_AVAILABLE", message: "No verified simulation solver is configured." };
  }
}
