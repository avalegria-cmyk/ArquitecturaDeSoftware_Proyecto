import { subscribeChanges } from "./realtime.js";
export async function request(path, options = {}) {
  const { notifySessionExpiry = true, ...fetchOptions } = options;
  let response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: "same-origin",
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "UniEquipos",
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "No se pudo conectar con el servidor. Comprueba que el sistema esté iniciado.",
    );
  }
  const data = await response.json().catch(() => ({
    message:
      response.status === 413
        ? "La foto supera el tamaño permitido. Toma otra foto."
        : response.status === 429
          ? "Demasiados intentos. Espera un minuto y vuelve a intentar."
          : "El servidor no está disponible.",
  }));
  if (!response.ok) {
    const error = new Error(
      data.message || "No se pudo completar la solicitud.",
    );
    error.status = response.status;
    if (
      notifySessionExpiry &&
      response.status === 401 &&
      path !== "/auth/login"
    )
      window.dispatchEvent(new Event("session-expired"));
    throw error;
  }
  return data;
}
export const api = {
  subscribeChanges,
  reports: () => request("/reports"),
  exportReport: async (id = null) => {
    let response;
    try {
      response = await fetch(
        `/api/reports/export${id ? `?equipmentId=${id}` : ""}`,
        { credentials: "same-origin" },
      );
    } catch {
      throw new Error("No se pudo conectar para descargar el Excel.");
    }
    if (!response.ok) {
      if (response.status === 401)
        window.dispatchEvent(new Event("session-expired"));
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "No se pudo exportar el Excel.");
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = `UniEquipos-${id ? `equipo-${id}` : "general"}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
  me: () => request("/auth/me", { notifySessionExpiry: false }),
  login: (email, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request("/auth/logout", { method: "POST", body: "{}" }),
  equipment: () => request("/equipment"),
  users: () => request("/users"),
  updateEquipment: (input) =>
    request("/equipment/update", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  disableEquipment: (id) =>
    request("/equipment/disable", {
      method: "POST",
      body: JSON.stringify({ id }),
    }),
  createEquipment: (equipment) =>
    request("/equipment", { method: "POST", body: JSON.stringify(equipment) }),
  reservations: () => request("/reservations"),
  completeMaintenance: (input) =>
    request("/maintenance/complete", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  maintenanceReviews: () => request("/maintenance/reviews"),
  maintenance: () => request("/maintenance"),
  loans: () => request("/loans"),
  recordLoan: (phase, payload) =>
    request(phase === "inicio" ? "/loans/start" : "/loans/return", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  approvals: () => request("/approvals"),
  reviewReservation: (decision) =>
    request("/approvals/decision", {
      method: "POST",
      body: JSON.stringify(decision),
    }),
  responsibleTeachers: () => request("/reservations/teachers"),
  availability: (interval = {}) =>
    request(
      `/reservations/availability${Object.keys(interval).length ? "?" + new URLSearchParams(interval) : ""}`,
    ),
  createReservation: (reservation) =>
    request("/reservations", {
      method: "POST",
      body: JSON.stringify(reservation),
    }),
};
