export const reservationStates = {
  en_revision: "En revisión",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
};
export const canRequestReservation = (role) =>
  ["estudiante", "docente"].includes(role);
export const reservationSteps = [
  ["enviado", "Enviado"],
  ["docente", "Aceptado por docente responsable"],
  ["jefe_laboratorio", "Aceptado por jefe de laboratorio"],
  ["encargado_laboratorio", "Aceptado por encargado de laboratorio"],
];

export const approvalStages = {
  docente: {
    key: "docente",
    label: "Docente responsable",
    description:
      "Revisa las reservas que te han asignado como docente responsable.",
  },
  administrador: {
    key: "jefe_laboratorio",
    label: "Jefe de laboratorio",
    description:
      "Como administrador, atiendes la fase de jefe de laboratorio después de la aprobación del docente.",
  },
  encargado: {
    key: "encargado_laboratorio",
    label: "Encargado de laboratorio",
    description:
      "Confirma las reservas que ya cuentan con la aprobación del docente y del jefe de laboratorio.",
  },
};
