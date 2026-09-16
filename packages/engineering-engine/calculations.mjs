export function calculateShaftStress({ loadN, diameterMm, yieldStrengthMpa, minimumFactorOfSafety = 2 }) {
  if (![loadN, diameterMm, yieldStrengthMpa].every((value) => Number.isFinite(value) && value > 0)) {
    return { status: "UNKNOWN", inputs: { loadN, diameterMm, yieldStrengthMpa }, formula: "sigma=F/A", result: null };
  }
  const areaMm2 = Math.PI * (diameterMm ** 2) / 4;
  const stressMpa = loadN / areaMm2;
  const factorOfSafety = yieldStrengthMpa / stressMpa;
  return {
    status: factorOfSafety >= minimumFactorOfSafety ? "PASS" : "FAIL",
    inputs: { loadN, diameterMm, yieldStrengthMpa, minimumFactorOfSafety },
    units: { loadN: "N", diameterMm: "mm", stressMpa: "MPa" },
    formula: "sigma=F/(pi*d^2/4); FoS=yieldStrength/sigma",
    result: { stressMpa, factorOfSafety },
    allowable: { minimumFactorOfSafety }
  };
}

export function calculateTorque({ powerW, speedRpm }) {
  if (![powerW, speedRpm].every((value) => Number.isFinite(value) && value > 0)) return { status: "UNKNOWN", result: null };
  const torqueNm = powerW / (2 * Math.PI * speedRpm / 60);
  return { status: "PASS", formula: "T=P/omega", result: { torqueNm }, units: { powerW: "W", speedRpm: "rpm", torqueNm: "N*m" } };
}
