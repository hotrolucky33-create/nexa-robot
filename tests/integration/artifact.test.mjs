import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ArtifactManager } from "../../packages/artifacts/manager.mjs";

test("artifact package writes manifest hashes and zip", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "vem-artifact-"));
  const result = await new ArtifactManager(root).packageRelease({
    productId: "TEST-PRESS-001",
    version: "v1.0.0",
    files: [{ name: "CAD/model.json", content: "{\"part\":\"SHAFT-001\"}" }]
  });
  assert.equal(result.manifest[0].sha256.length, 64);
  assert.equal((await fs.stat(result.zipPath)).isFile(), true);
  await fs.rm(root, { recursive: true, force: true });
});
