import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import archiver from "archiver";
import { createWriteStream } from "node:fs";

export class ArtifactManager {
  constructor(root) { this.root = root; }
  async packageRelease({ productId, version, files }) {
    const directory = path.join(this.root, productId, version);
    await fs.mkdir(directory, { recursive: true });
    const manifest = [];
    for (const file of files) {
      const target = path.join(directory, file.name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file.content);
      const buffer = await fs.readFile(target);
      manifest.push({ file: file.name, size: buffer.length, sha256: crypto.createHash("sha256").update(buffer).digest("hex"), version });
    }
    await fs.writeFile(path.join(directory, "manifest.json"), JSON.stringify({ productId, version, files: manifest }, null, 2));
    const zipPath = path.join(this.root, `${productId}-${version}.zip`);
    await new Promise((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });
      output.on("close", resolve);
      archive.on("error", reject);
      archive.pipe(output);
      archive.directory(directory, false);
      archive.finalize();
    });
    return { directory, zipPath, manifest };
  }
}
