import { setTimeout as sleep } from "node:timers/promises";

export async function runJob(job) {
  if (!job?.id || !job.type) throw new Error("JOB_ID_AND_TYPE_REQUIRED");
  await sleep(0);
  return { id: job.id, type: job.type, status: "WAITING_FOR_PROVIDER", message: "A durable Redis queue is required for production execution." };
}
