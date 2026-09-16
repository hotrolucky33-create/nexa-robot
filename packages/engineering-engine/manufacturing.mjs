export function validateManufacturing(part) {
  const checks = [
    { ruleId: "MIN_WALL", description: "minimum wall thickness", source: "MFG-RULE-MVP-001", status: part.wallThicknessMm >= 3 ? "PASS" : "FAIL", actual: part.wallThicknessMm },
    { ruleId: "MIN_HOLE", description: "minimum hole diameter", source: "MFG-RULE-MVP-002", status: part.holeDiameterMm === undefined || part.holeDiameterMm >= 5 ? "PASS" : "FAIL", actual: part.holeDiameterMm ?? null }
  ];
  return { status: checks.every((check) => check.status === "PASS") ? "PASS" : "FAIL", checks };
}
