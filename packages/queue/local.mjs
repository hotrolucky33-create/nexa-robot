export class LocalQueue {
  constructor() { this.jobs = []; }
  enqueue(job) {
    if (!job?.id || !job.type) throw new Error("JOB_ID_AND_TYPE_REQUIRED");
    if (this.jobs.some((item) => item.id === job.id)) return { status: "IDEMPOTENT", job };
    const queued = { ...job, status: "QUEUED", attempts: 0 };
    this.jobs.push(queued);
    return { status: "QUEUED", job: queued };
  }
  next() { return this.jobs.find((job) => job.status === "QUEUED"); }
  complete(id) { const job = this.jobs.find((item) => item.id === id); if (!job) throw new Error("JOB_NOT_FOUND"); job.status = "COMPLETED"; return job; }
  fail(id, error) { const job = this.jobs.find((item) => item.id === id); if (!job) throw new Error("JOB_NOT_FOUND"); job.status = "FAILED"; job.error = String(error); return job; }
}

export class RedisQueueProvider {
  constructor() { this.status = "NOT_AVAILABLE"; }
  health() { return { status: this.status, detail: "Redis client and server are not configured." }; }
}
