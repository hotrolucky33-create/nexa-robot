import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AnalyticalCadProvider } from "../cad/engine.mjs";
import { calculateShaftStress } from "../engineering-engine/calculations.mjs";
import { analyzeTolerance } from "../engineering-engine/tolerance.mjs";
import { validateManufacturing } from "../engineering-engine/manufacturing.mjs";
import { ArtifactManager } from "../artifacts/manager.mjs";
import { buildFailureReport } from "./pipeline.mjs";

export async function runFactory(spec, { outputRoot = "./products/generated", maxIterations = 20 } = {}) {
  const runId = randomUUID();
  const cad = new AnalyticalCadProvider();
  const model = spec.cadModel || cad.createTestPress();
  const geometry = cad.validateGeometry(model);
  const assembly = cad.validateAssembly(model);
  const shaft = spec.shaft || { loadN: 1000, diameterMm: 20, yieldStrengthMpa: 300, minimumFactorOfSafety: 2 };
  const calculation = calculateShaftStress(shaft);
  const tolerance = analyzeTolerance(spec.tolerance || { nominal: 20, tolerance: 0.02 });
  const manufacturing = validateManufacturing(spec.manufacturing || { wallThicknessMm: 3 });
  const checks = [
    { id: "CAD", category: "cad", status: geometry.status, evidence: geometry },
    { id: "ASSEMBLY", category: "assembly", status: assembly.status, evidence: assembly },
    { id: "CALCULATION", category: "calculation", status: calculation.status, evidence: calculation },
    { id: "TOLERANCE", category: "tolerance", status: tolerance.status, evidence: tolerance },
    { id: "MANUFACTURING", category: "manufacturing", status: manufacturing.status, evidence: manufacturing },
    { id: "FEA", category: "simulation", status: "NOT_AVAILABLE", evidence: "No real FEA solver configured" }
  ];
  const failureReport = buildFailureReport(checks);
  const status = checks.every((check) => check.status === "PASS") ? "VERIFIED" : "NOT_VERIFIED";
  const report = { runId, productId: spec.id || "UNNAMED", status, iterations: 1, maxIterations, checks, failureReport };
  const directory = path.resolve(outputRoot, report.productId, runId);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, "verification-report.json"), JSON.stringify(report, null, 2));
  const artifact = await new ArtifactManager(path.resolve(outputRoot, "packages")).packageRelease({
    productId: report.productId,
    version: spec.version || "v1.0.0",
    files: [
      { name: "VERIFICATION/verification-report.json", content: JSON.stringify(report, null, 2) },
      { name: "CAD/model.json", content: JSON.stringify(model, null, 2) }
    ]
  });
  return { ...report, artifact };
}
