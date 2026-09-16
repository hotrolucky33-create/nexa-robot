export function crossValidate({ cad, drawing, bom, assembly, calculations }) {
  const checks = [];
  for (const drawingPart of drawing) {
    const cadPart = cad.find((part) => part.id === drawingPart.partId);
    checks.push({ id: `DRAWING-${drawingPart.partId}`, status: cadPart && cadPart.diameterMm === drawingPart.diameterMm ? "PASS" : "FAIL", evidence: { cad: cadPart?.diameterMm ?? null, drawing: drawingPart.diameterMm } });
  }
  for (const bomPart of bom) {
    const assemblyPart = assembly.find((part) => part.partId === bomPart.partId);
    checks.push({ id: `BOM-${bomPart.partId}`, status: assemblyPart?.quantity === bomPart.quantity ? "PASS" : "FAIL", evidence: { bom: bomPart.quantity, assembly: assemblyPart?.quantity ?? null } });
  }
  checks.push({ id: "CALC-EVIDENCE", status: calculations?.status === "PASS" ? "PASS" : calculations?.status || "UNKNOWN", evidence: "calculation result linked to part" });
  return { status: checks.every((check) => check.status === "PASS") ? "PASS" : "FAIL", checks };
}
