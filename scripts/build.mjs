import fs from "node:fs";
import path from "node:path";
const required = [
  "apps/api/server.mjs",
  "apps/web/index.html",
  "packages/verification/index.mjs",
  "packages/cad/engine.mjs",
  "packages/engineering-engine/calculations.mjs",
  "packages/artifacts/manager.mjs"
];
for (const file of required) if (!fs.existsSync(path.resolve(file))) throw new Error(`Missing build input: ${file}`);
console.log(`Build validation passed for ${required.length} modules.`);
