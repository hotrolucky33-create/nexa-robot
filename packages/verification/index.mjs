const check = (id, category, status, expected, actual, evidence) => ({ id, category, status, expected, actual, evidence });

export function verifyProduct(spec) {
  const checks = [];
  const evidence = [];
  const shaft = spec.parts?.find((part) => part.id === "SHAFT-001");
  const drawing = spec.drawings?.find((item) => item.partId === "SHAFT-001");
  const bom = spec.bom || [];
  const material = spec.materials?.find((item) => item.id === shaft?.materialId);
  checks.push(check("SPEC-001", "specification", spec.name ? "PASS" : "FAIL", "name", spec.name || null, "product.name"));
  checks.push(check("CAD-001", "cad", shaft?.geometry?.diameterMm > 0 ? "PASS" : "FAIL", "positive shaft diameter", shaft?.geometry?.diameterMm ?? null, "parts[SHAFT-001].geometry"));
  checks.push(check("MAT-001", "material", material?.status === "VERIFIED" ? "PASS" : "UNKNOWN", "verified material", material?.status ?? "missing", "materials"));
  checks.push(check("SIM-001", "simulation", "UNKNOWN", "solver result", "NOT_AVAILABLE", "No simulation provider configured"));
  checks.push(check("BOM-001", "bom", shaft && bom.some((item) => item.partId === shaft.id) ? "PASS" : "FAIL", "shaft in BOM", bom.map((item) => item.partId), "bom"));
  checks.push(check("DRAW-001", "drawing", drawing?.diameterMm === shaft?.geometry?.diameterMm ? "PASS" : "FAIL", shaft?.geometry?.diameterMm ?? null, drawing?.diameterMm ?? null, "drawing↔CAD"));
  if (shaft && material?.yieldStrengthMpa && shaft.loadN && shaft.geometry.diameterMm) {
    const area = Math.PI * (shaft.geometry.diameterMm / 1000) ** 2 / 4;
    const stressMpa = shaft.loadN / area / 1e6;
    const factorOfSafety = material.yieldStrengthMpa / stressMpa;
    const calculation = { stressMpa: Number(stressMpa.toFixed(3)), factorOfSafety: Number(factorOfSafety.toFixed(3)) };
    checks.push(check("CALC-001", "calculation", factorOfSafety >= (shaft.minimumFactorOfSafety || 2) ? "PASS" : "FAIL", `factorOfSafety >= ${shaft.minimumFactorOfSafety || 2}`, calculation, "deterministic axial stress calculation"));
    evidence.push({ id: "CALC-001", inputs: { loadN: shaft.loadN, diameterMm: shaft.geometry.diameterMm }, result: calculation });
  } else checks.push(check("CALC-001", "calculation", "UNKNOWN", "complete load/material/geometry inputs", "insufficient inputs", "calculation engine"));
  checks.push(check("TOL-001", "tolerance", shaft?.tolerance?.minMm <= shaft?.tolerance?.maxMm ? "PASS" : "FAIL", "min <= max", shaft?.tolerance ?? null, "tolerance analysis"));
  checks.push(check("MFG-001", "manufacturing", "UNKNOWN", "defined manufacturing rules", "NOT_AVAILABLE", "manufacturing provider"));
  checks.push(check("ADV-001", "adversarial", "UNKNOWN", "completed adversarial review", "NOT_AVAILABLE", "adversarial agent"));
  return { status: checks.every((item) => item.status === "PASS") ? "PASS" : "FAIL", checks, evidence, score: checks.filter((item) => item.status === "PASS").length / checks.length };
}
