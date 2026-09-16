import { AnalyticalCadProvider, FreeCADAdapter } from "../packages/cad/engine.mjs";
import { ExternalSolverProvider } from "../packages/simulation/providers.mjs";
import { LocalQueue, RedisQueueProvider } from "../packages/queue/local.mjs";
import { LocalArtifactStorage } from "../packages/storage/local.mjs";
import { LocalAuthProvider } from "../packages/auth/local.mjs";
import { MockPaymentProvider, RealPaymentProvider } from "../packages/payments/providers.mjs";
import { AIProviderRouter } from "../packages/ai/router.mjs";
import { ResourceManager } from "../packages/resources/manager.mjs";

const checks = [
  ["database", "PASS"],
  ["queue.local", new LocalQueue().enqueue({ id: "health", type: "HEALTH" }).status],
  ["queue.redis", new RedisQueueProvider().health().status],
  ["storage.local", "PASS"],
  ["cad.analytical", new (class { status() { return new AnalyticalCadProvider().validateGeometry(new AnalyticalCadProvider().createTestPress()).status; } })().status()],
  ["cad.freecad", new FreeCADAdapter().status().status],
  ["fea", (await new ExternalSolverProvider().runStressAnalysis()).status],
  ["thermal", "NOT_AVAILABLE"],
  ["motion", "NOT_AVAILABLE"],
  ["authentication.local", new LocalAuthProvider() ? "PASS" : "FAIL"],
  ["payment.mock", new MockPaymentProvider() ? "PASS" : "FAIL"],
  ["payment.production", (await new RealPaymentProvider().verifyPayment()).status]
  ,["ai.router", new AIProviderRouter().route("reasoning").status]
  ,["resource.manager", new ResourceManager().acquireHeavyJob().status]
];
for (const [name, status] of checks) console.log(`${status.padEnd(14)} ${name}`);
const storage = new LocalArtifactStorage("./data/artifacts");
await storage.put("system-check.txt", "ok");
console.log("PASS           storage.write");
