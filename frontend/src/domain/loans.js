export function loanAction(reservation, userId, now, role) {
  const adminTest = role === "administrador";
  if (!adminTest && reservation.requester.id !== userId) return null;
  if (reservation.loan?.returnedAt) return null;
  if (reservation.loan)
    return {
      phase: "devolucion",
      enabled: true,
      label: adminTest ? "Cerrar préstamo (prueba)" : "Devolver equipo",
    };
  if (reservation.status !== "aceptado") return null;
  if (!adminTest && now >= Date.parse(reservation.endsAt))
    return { phase: "inicio", enabled: false, label: "Período finalizado" };
  if (!adminTest && now < Date.parse(reservation.startsAt))
    return {
      phase: "inicio",
      enabled: false,
      label: "Iniciar uso",
      reason: "Se habilita en la fecha y hora de inicio.",
    };
  if (reservation.equipmentStatus !== "disponible")
    return {
      phase: "inicio",
      enabled: false,
      label: "Unidad no disponible",
      reason: "Actualiza para consultar si el equipo ya está disponible.",
    };
  return {
    phase: "inicio",
    enabled: true,
    label: adminTest ? "Iniciar uso (prueba)" : "Iniciar uso",
  };
}
export function loanState(reservation, now) {
  if (reservation.loan?.returnedAt)
    return { label: "Devuelto", className: "devuelto" };
  if (reservation.loan)
    return now >= Date.parse(reservation.endsAt)
      ? { label: "En uso · devolución atrasada", className: "atrasado" }
      : { label: "En uso", className: "en-uso" };
  if (reservation.status === "aceptado")
    return now >= Date.parse(reservation.endsAt)
      ? { label: "Sin retirar · período finalizado", className: "sin-retirar" }
      : { label: "Pendiente de iniciar", className: "pendiente" };
  return null;
}
