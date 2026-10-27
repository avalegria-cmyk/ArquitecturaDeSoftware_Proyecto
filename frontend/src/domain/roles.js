export const roles = {
  administrador: "Administrador",
  encargado: "Encargado de equipos",
  estudiante: "Estudiante",
  docente: "Docente",
};
export const canManage = (role) =>
  ["administrador", "encargado"].includes(role);
export const modulesFor = (role) => [
  "inicio",
  "equipos",
  "reservas",
  ...(["docente", "administrador", "encargado"].includes(role)
    ? ["aprobaciones"]
    : []),
  "prestamos",
  ...(canManage(role) ? ["mantenimiento", "reportes"] : []),
  ...(role === "administrador" ? ["usuarios"] : []),
  "perfil",
];
