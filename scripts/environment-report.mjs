import os from "node:os";
import { execFileSync } from "node:child_process";

const command = (name, args = ["--version"]) => {
  try { return execFileSync(name, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch { return "NOT_FOUND"; }
};
const report = {
  platform: process.platform,
  arch: process.arch,
  cpuCores: os.cpus().length,
  memoryGb: Number((os.totalmem() / 1024 ** 3).toFixed(1)),
  node: process.version,
  python: command("python", ["--version"]),
  docker: command("docker", ["--version"]),
  freecad: command("freecad", ["--version"]),
  calculix: command("ccx", ["-v"]),
  ollama: command("ollama", ["--version"])
};
console.log(JSON.stringify(report, null, 2));
