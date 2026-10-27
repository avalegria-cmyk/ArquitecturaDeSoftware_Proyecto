// Las entradas datetime-local representan la hora del campus (UTC-05:00).
export const campusDate = (value) =>
  new Date(value.length === 16 ? `${value}:00-05:00` : value);
export function campusNowInput() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
export function intervalError(start, end) {
  if (!start || !end)
    return "Selecciona la fecha y hora de inicio y devolución.";
  const a = campusDate(start),
    b = campusDate(end);
  if (Number.isNaN(+a) || Number.isNaN(+b))
    return "Selecciona fechas y horas válidas.";
  if (a <= new Date()) return "El inicio debe ser posterior al momento actual.";
  if (b <= a) return "La devolución debe ser posterior al inicio.";
  return "";
}
export function formatCampusDate(value) {
  return new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(campusDate(value));
}
export function durationLabel(start, end) {
  const minutes = Math.round((campusDate(end) - campusDate(start)) / 60000);
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const days = Math.floor(minutes / 1440),
    hours = Math.floor((minutes % 1440) / 60),
    remaining = minutes % 60;
  return [
    days && `${days} ${days === 1 ? "día" : "días"}`,
    hours && `${hours} h`,
    remaining && `${remaining} min`,
  ]
    .filter(Boolean)
    .join(" ");
}
export function searchReservableEquipment(items, query) {
  const normalize = (value) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const term = normalize(query.trim());
  return items.filter((item) =>
    normalize(
      `${item.category} ${item.name} ${item.code} ${item.location}`,
    ).includes(term),
  );
}
