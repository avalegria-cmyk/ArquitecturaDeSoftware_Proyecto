import { describe, expect, test } from "bun:test";
process.env.DB_PATH = ":memory:";
const { validarRevision, autorizarRevision } = await import("../src/controllers/mantenimiento.controller");
const { medidasJpeg, decodificar } = await import("../src/services/foto");
const { Revisiones } = await import("../src/models/revision.model");

describe("revisión de mantenimiento", () => {
  test("exige comentarios", () => {
    expect(() => validarRevision({ equipmentId: 1, comments: "   ", photo: "" })).toThrow("Describe el estado");
  });
  test("el préstamo es opcional", () => {
    expect(validarRevision({ equipmentId: 1, comments: "Lente limpio", photo: "" }).loanId).toBeNull();
  });
  test("un estudiante no registra revisiones", () => {
    expect(() => autorizarRevision({ id: 5, role: "estudiante", name: "x" })).toThrow();
  });
  test("lee medidas del JPEG y rechaza base64 inválido", () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(medidasJpeg(jpeg)).toEqual({ width: 640, height: 480 });
    expect(() => decodificar("@@", "no")).toThrow();
  });
  test("guarda y lista revisiones en SQLite", () => {
    const id = Revisiones.crear({ equipment_id: 1, equipment_code: "LAP-001", equipment_name: "Laptop", loan_id: null, reviewer_id: 2, reviewer_name: "Encargado", comments: "ok", photo: new Uint8Array([1]), reviewed_at: "2026-01-01T00:00:00Z" });
    expect(Revisiones.todas(1).map((r) => r.id)).toContain(id);
  });
});
