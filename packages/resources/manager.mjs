import os from "node:os";

export class ResourceManager {
  constructor({ maxConcurrentHeavyJobs = 1 } = {}) {
    this.maxConcurrentHeavyJobs = maxConcurrentHeavyJobs;
    this.activeHeavyJobs = 0;
  }
  snapshot() {
    return { cpuCores: os.cpus().length, memoryBytes: os.totalmem(), activeHeavyJobs: this.activeHeavyJobs, maxConcurrentHeavyJobs: this.maxConcurrentHeavyJobs };
  }
  acquireHeavyJob() {
    if (this.activeHeavyJobs >= this.maxConcurrentHeavyJobs) return { status: "QUEUED", reason: "RESOURCE_LIMIT" };
    this.activeHeavyJobs += 1;
    return { status: "ACQUIRED" };
  }
  releaseHeavyJob() { if (this.activeHeavyJobs > 0) this.activeHeavyJobs -= 1; return this.snapshot(); }
}
