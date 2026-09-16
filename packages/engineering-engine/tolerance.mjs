export function analyzeTolerance({ nominal, tolerance }) {
  if (!Number.isFinite(nominal) || !Number.isFinite(tolerance) || tolerance < 0) return { status: "UNKNOWN" };
  return { status: "PASS", nominal, minimum: nominal - tolerance, maximum: nominal + tolerance, evidence: "worst-case symmetric tolerance" };
}

export function analyzeClearance({ shaft, bearing }) {
  if (!shaft || !bearing) return { status: "UNKNOWN" };
  const minimum = bearing.nominal - bearing.tolerance - (shaft.nominal + shaft.tolerance);
  const maximum = bearing.nominal + bearing.tolerance - (shaft.nominal - shaft.tolerance);
  return { status: minimum >= 0 ? "PASS" : "FAIL", minimum, maximum, evidence: "bearing ID minus shaft OD, worst-case limits" };
}
