import { describe, it, expect } from "vitest";
import { filterEquipment, summarizeEquipment } from "./catalog.js";
import { modulesFor } from "../domain/roles.js";
const items = [
  {
    name: "Laptop",
    code: "LAP-001",
    location: "Laboratorio",
    category: "Computadoras",
    status: "disponible",
  },
  {
    name: "Sensor",
    code: "IOT-001",
    location: "Bodega",
    category: "IoT",
    status: "mantenimiento",
  },
];
describe("Catálogo", () => {
  it("combina búsqueda, categoría y estado", () => {
    expect(
      filterEquipment(items, " lap ", "Computadoras", "disponible"),
    ).toHaveLength(1);
    expect(filterEquipment(items, "lap", "", "mantenimiento")).toHaveLength(0);
  });
  it("encuentra equipos por ubicación y código", () => {
    expect(filterEquipment(items, "bodega", "", "")[0].code).toBe("IOT-001");
    expect(filterEquipment(items, "LAP-001", "", "")).toHaveLength(1);
  });
  it("cuenta estados sin inventar préstamos ni reservas", () => {
    expect(summarizeEquipment(items)).toEqual({
      total: 2,
      available: 1,
      maintenance: 1,
      unavailable: 0,
    });
  });
});
describe("Navegación por rol", () => {
  it("solo expone usuarios a administradores", () => {
    expect(modulesFor("administrador")).toContain("usuarios");
    for (const role of ["estudiante", "docente", "encargado"])
      expect(modulesFor(role)).not.toContain("usuarios");
  });
  it("reserva mantenimiento al personal encargado", () => {
    expect(modulesFor("encargado")).toContain("mantenimiento");
    expect(modulesFor("estudiante")).not.toContain("mantenimiento");
  });
});
