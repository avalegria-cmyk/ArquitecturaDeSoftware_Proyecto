export function filterEquipment(items, search, category, status) {
  const term = search.trim().toLocaleLowerCase("es");
  return items.filter(
    (item) =>
      `${item.name} ${item.code} ${item.category} ${item.location}`
        .toLocaleLowerCase("es")
        .includes(term) &&
      (!category || item.category === category) &&
      (!status || item.status === status),
  );
}
export function summarizeEquipment(items) {
  return {
    total: items.length,
    available: items.filter((e) => e.status === "disponible").length,
    maintenance: items.filter((e) => e.status === "mantenimiento").length,
    unavailable: items.filter((e) => e.status === "fuera_servicio").length,
  };
}
