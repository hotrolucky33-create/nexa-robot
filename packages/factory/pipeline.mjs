import { calculateShaftStress } from "../engineering-engine/calculations.mjs";
import { analyzeTolerance } from "../engineering-engine/tolerance.mjs";
import { validateManufacturing } from "../engineering-engine/manufacturing.mjs";
import { crossValidate } from "../engineering-engine/cross-document.mjs";

export function buildFailureReport(checks) {
  return checks.filter((check) => check.status !== "PASS").map((check) => ({
    failure: check.id,
    actual: check.actual ?? check.evidence,
    severity: check.category === "calculation" ? "CRITICAL" : check.status === "NOT_AVAILABLE" ? "BLOCKED" : "HIGH",
    evidence: check.evidence
  }));
}

export function runEngineeringPipeline(input) {
  const calculation = calculateShaftStress(input.shaft);
  const tolerance = analyzeTolerance(input.tolerance);
  const manufacturing = validateManufacturing(input.manufacturing);
  const crossDocument = crossValidate({
    cad: input.cad,
    drawing: input.drawing,
    bom: input.bom,
    assembly: input.assembly,
    calculations: calculation
  });
  const checks = [
    { id: "CALC-001", category: "calculation", status: calculation.status, evidence: calculation },
    { id: "TOL-001", category: "tolerance", status: tolerance.status, evidence: tolerance },
    { id: "MFG-001", category: "manufacturing", status: manufacturing.status, evidence: manufacturing },
    { id: "CROSS-001", category: "cross-document", status: crossDocument.status, evidence: crossDocument }
  ];
  return { status: checks.every((check) => check.status === "PASS") ? "PASS" : "FAIL", checks, failureReport: buildFailureReport(checks) };
}
