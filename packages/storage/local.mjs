import fs from "node:fs/promises";
import path from "node:path";

export class LocalArtifactStorage {
  constructor(root) { this.root = root; }
  async put(key, content) { const target = path.join(this.root, key); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content); return { status: "STORED", key }; }
  async createSignedUrl(key, expiresInSeconds = 900) { return { status: "SIGNED", key, expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString() }; }
}
