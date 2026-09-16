export const CAD_STATUS = Object.freeze({ PASS: "PASS", FAIL: "FAIL", NOT_AVAILABLE: "NOT_AVAILABLE" });

export class AnalyticalCadProvider {
  constructor() { this.name = "analytical-parametric-model"; }

  createTestPress() {
    return {
      id: "TEST-PRESS-001",
      revision: "v1.0.0",
      parts: [
        { id: "BASE-001", kind: "box", materialId: "C45", originMm: [0, 0, 0], sizeMm: [300, 220, 20] },
        { id: "FRAME-001", kind: "box", materialId: "C45", originMm: [30, 30, 20], sizeMm: [240, 20, 260] },
        { id: "SHAFT-001", kind: "cylinder", materialId: "C45", originMm: [150, 110, 20], diameterMm: 20, lengthMm: 220 },
        { id: "BEARING-001", kind: "cylinder", materialId: "C45", originMm: [150, 110, 215], diameterMm: 40, lengthMm: 30 },
        { id: "HANDLE-001", kind: "box", materialId: "C45", originMm: [110, 100, 250], sizeMm: [80, 20, 10] },
        { id: "PLATE-001", kind: "box", materialId: "C45", originMm: [90, 60, 190], sizeMm: [120, 100, 20] }
      ]
    };
  }

  validateGeometry(model) {
    const checks = model.parts.map((part) => {
      const valid = part.kind === "box"
        ? part.sizeMm.every((value) => Number.isFinite(value) && value > 0)
        : Number.isFinite(part.diameterMm) && part.diameterMm > 0 && Number.isFinite(part.lengthMm) && part.lengthMm > 0;
      return { id: `CAD-${part.id}`, status: valid ? CAD_STATUS.PASS : CAD_STATUS.FAIL, partId: part.id, volumeMm3: valid ? this.volume(part) : 0 };
    });
    const ids = model.parts.map((part) => part.id);
    if (new Set(ids).size !== ids.length) checks.push({ id: "CAD-DUPLICATE", status: CAD_STATUS.FAIL, evidence: "duplicate part IDs" });
    return { status: checks.every((item) => item.status === CAD_STATUS.PASS) ? CAD_STATUS.PASS : CAD_STATUS.FAIL, checks };
  }

  volume(part) {
    return part.kind === "box"
      ? part.sizeMm.reduce((total, value) => total * value, 1)
      : Math.PI * (part.diameterMm / 2) ** 2 * part.lengthMm;
  }

  validateAssembly(model) {
    const collisions = [];
    for (let index = 0; index < model.parts.length; index += 1) {
      for (let other = index + 1; other < model.parts.length; other += 1) {
        const a = this.bounds(model.parts[index]);
        const b = this.bounds(model.parts[other]);
        if (this.intersects(a, b) && !this.allowedContact(model.parts[index], model.parts[other])) {
          collisions.push({ first: model.parts[index].id, second: model.parts[other].id });
        }
      }
    }
    return { status: collisions.length ? CAD_STATUS.FAIL : CAD_STATUS.PASS, collisions };
  }

  bounds(part) {
    const [x, y, z] = part.originMm;
    if (part.kind === "box") return { min: [x, y, z], max: part.sizeMm.map((size, index) => [x, y, z][index] + size) };
    const radius = part.diameterMm / 2;
    return { min: [x - radius, y - radius, z], max: [x + radius, y + radius, z + part.lengthMm] };
  }

  intersects(a, b) {
    return a.min.every((value, index) => value < b.max[index] && a.max[index] > b.min[index]);
  }

  allowedContact(a, b) {
    return (a.id === "BASE-001" && b.id === "FRAME-001") || (a.id === "FRAME-001" && b.id === "BASE-001");
  }
}

export class FreeCADAdapter {
  constructor(executable = null) { this.executable = executable; }
  status() {
    return this.executable ? { status: CAD_STATUS.NOT_AVAILABLE, detail: "Executable probing is not enabled in this adapter." } : { status: CAD_STATUS.NOT_AVAILABLE, detail: "FreeCAD executable is not configured." };
  }
}
