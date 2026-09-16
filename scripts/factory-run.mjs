import fs from "node:fs/promises";
import process from "node:process";
import { runFactory } from "../packages/factory/product-factory.mjs";

const [, , inputPath] = process.argv;
if (!inputPath) throw new Error("Usage: npm run factory-run -- path/to/product_spec.json");
const spec = JSON.parse(await fs.readFile(inputPath, "utf8"));
const result = await runFactory(spec);
console.log(JSON.stringify({ status: result.status, productId: result.productId, failures: result.failureReport.length, package: result.artifact.zipPath }, null, 2));
