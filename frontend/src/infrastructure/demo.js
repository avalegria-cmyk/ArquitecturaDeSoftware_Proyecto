// Adaptador en memoria exclusivo de la vista previa; el modo normal usa MySQL.
import initialEquipment from "./demo-equipment.json";
import { canManage } from "../domain/roles.js";
import {
  canRequestReservation,
  approvalStages,
  reservationSteps,
} from "../domain/reservations.js";
import { campusDate, intervalError } from "../application/reservations.js";
const equipment = structuredClone(initialEquipment);
const users = ["administrador", "encargado", "estudiante", "docente"].map(
  (role, i) => ({
    id: i + 1,
    name:
      {
        administrador: "Administración",
        encargado: "Encargado",
        estudiante: "Estudiante",
        docente: "Docente",
      }[role] + " demo",
    email: role + "@demo.uniequipos.test",
    role,
  }),
);
const reservations = [];
const reviews = [];
let current = null;
function signedIn() {
  if (!current) throw new Error("Inicia sesión para continuar.");
  return current;
}
function overlaps(a, b) {
  return (
    campusDate(a.startsAt) < campusDate(b.endsAt) &&
    campusDate(a.endsAt) > campusDate(b.startsAt)
  );
}
function available(interval) {
  return equipment.filter(
    (e) =>
      e.status === "disponible" &&
      (!interval.startsAt ||
        !reservations.some(
          (r) =>
            r.equipment.id === e.id &&
            r.status !== "rechazado" &&
            !r.loan?.returnedAt &&
            overlaps(r, interval),
        )),
  );
}
const presentReservation = (r) =>
  structuredClone({
    ...r,
    equipmentStatus: r.equipment.status,
    loan: r.loan || null,
  });
const codeCounters = {};
function nextEquipmentCode(category) {
  const prefix =
    {
      computadoras: "LAP",
      laptops: "LAP",
      cámaras: "CAM",
      camaras: "CAM",
      proyectores: "PRO",
      "iot y electrónica": "IOT",
      "iot y electronica": "IOT",
      laboratorio: "LAB",
      audiovisuales: "AV",
    }[category.trim().toLowerCase()] || "EQ";
  const last = Math.max(
    codeCounters[prefix] || 0,
    ...equipment
      .filter((e) => new RegExp(`^${prefix}-[0-9]+$`).test(e.code))
      .map((e) => Number(e.code.split("-").at(-1))),
  );
  codeCounters[prefix] = last + 1;
  return `${prefix}-${String(last + 1).padStart(3, "0")}`;
}
export const demoApi = {
  reports: async () => {
    if (!canManage(signedIn().role)) throw new Error("Acceso no permitido.");
    return {
      equipment: equipment.map((e) => ({
        ...e,
        totalLoans: reservations.filter(
          (r) => r.equipment.id === e.id && r.loan,
        ).length,
        activeLoans: reservations.filter(
          (r) => r.equipment.id === e.id && r.loan && !r.loan.returnedAt,
        ).length,
        totalReviews: reviews.filter((m) => m.code === e.code).length,
      })),
      loans: reservations
        .filter((r) => r.loan)
        .map((r) => ({
          ...r.loan,
          equipmentId: r.equipment.id,
          code: r.equipment.code,
          name: r.equipment.name,
          reservationId: r.id,
          requester: r.requester.name,
          email: r.requester.email,
          teacher: r.teacher.name,
          purpose: r.purpose,
          reservedStart: r.startsAt,
          reservedEnd: r.endsAt,
          state: r.loan.returnedAt ? "Devuelto" : "En uso",
        })),
      reviews: reviews.map((m) => ({
        ...m,
        equipmentId: equipment.find((e) => e.code === m.code)?.id,
      })),
      generatedAt: new Date().toISOString(),
    };
  },
  exportReport: async () => {
    throw new Error(
      "La descarga Excel está disponible en el sistema conectado a MySQL; esta vista previa solo usa datos en memoria.",
    );
  },
  me: async () => ({ user: signedIn() }),
  login: async (email, password) => {
    const user = users.find((u) => u.email === email.trim().toLowerCase());
    if (!user || password !== "DemoEquipos2026!")
      throw new Error("Correo o contraseña incorrectos.");
    current = user;
    return { user };
  },
  logout: async () => {
    current = null;
  },
  equipment: async () => {
    signedIn();
    return { equipment: [...equipment] };
  },
  users: async () => {
    if (signedIn().role !== "administrador")
      throw new Error("Acceso no permitido.");
    return { users };
  },
  updateEquipment: async (input) => {
    if (!canManage(signedIn().role)) throw new Error("Acceso no permitido.");
    const item = equipment.find((e) => e.id === input.id);
    if (!item) throw new Error("El equipo no existe.");
    const images = (item.images || []).filter(
      (image) => !input.removeImageIds.includes(image.id),
    );
    if (images.length + input.photos.length > 5)
      throw new Error("Máximo 5 imágenes.");
    if (item.category.trim().toLowerCase() !== input.category.trim().toLowerCase()) item.code = nextEquipmentCode(input.category);
    for (const key of ["name", "category", "location", "description"])
      item[key] = input[key].trim();
    item.images = [
      ...images,
      ...input.photos.map((photo, i) => ({
        id: Date.now() + i,
        url: `data:image/jpeg;base64,${photo}`,
      })),
    ];
    return { message: "Equipo modificado." };
  },
  disableEquipment: async (id) => {
    if (!canManage(signedIn().role)) throw new Error("Acceso no permitido.");
    const item = equipment.find((e) => e.id === id);
    if (!item || item.status === "prestado")
      throw new Error("Primero registra la devolución del préstamo activo.");
    item.status = "deshabilitado";
    return { message: "Equipo deshabilitado." };
  },
  createEquipment: async (input) => {
    if (!canManage(signedIn().role))
      throw new Error("No tienes permiso para agregar equipos.");
    const code = nextEquipmentCode(input.category);
    if (equipment.some((e) => e.code === code))
      throw new Error("Ya existe un equipo con ese código.");
    const item = {
      ...input,
      code,
      id: Math.max(0, ...equipment.map((e) => e.id)) + 1,
    };
    item.images = (input.photos || []).map((photo, i) => ({
      id: Date.now() + i,
      url: `data:image/jpeg;base64,${photo}`,
    }));
    delete item.photos;
    equipment.push(item);
    return { equipment: item };
  },
  responsibleTeachers: async () => {
    signedIn();
    return {
      teachers: users
        .filter((u) => u.role === "docente")
        .map(({ id, name }) => ({ id, name })),
    };
  },
  availability: async (interval = {}) => {
    signedIn();
    if (interval.startsAt || interval.endsAt) {
      const error = intervalError(interval.startsAt, interval.endsAt);
      if (error) throw new Error(error);
    }
    return {
      equipment: available(interval),
      intervalChecked: !!interval.startsAt,
    };
  },
  reservations: async () => ({
    reservations: reservations
      .filter((r) => r.requester.id === signedIn().id)
      .slice()
      .reverse()
      .map(presentReservation),
    serverNow: new Date().toISOString(),
  }),
  maintenanceReviews: async () => {
    if (!canManage(signedIn().role)) throw new Error("Acceso no permitido.");
    return { reviews: structuredClone(reviews).reverse() };
  },
  completeMaintenance: async (input) => {
    const actor = signedIn();
    if (!canManage(actor.role)) throw new Error("Acceso no permitido.");
    const item = equipment.find((e) => e.id === input.equipmentId);
    const latest = reservations
      .filter((r) => r.equipment.id === item?.id && r.loan)
      .at(-1);
    if (
      !item ||
      item.status !== "mantenimiento" ||
      (latest?.loan?.id ?? null) !== input.loanId ||
      (latest && !latest.loan.returnedAt)
    )
      throw new Error(
        "La unidad cambió de estado. Consulta el detalle actualizado.",
      );
    if (
      !input.comments?.trim() ||
      input.comments.length > 2000 ||
      !input.photo ||
      input.photo.length > 5592408
    )
      throw new Error("Completa los comentarios y la foto de revisión.");
    reviews.push({
      id: reviews.length + 1,
      code: item.code,
      name: item.name,
      comments: input.comments.trim(),
      reviewer: actor.name,
      reviewedAt: new Date().toISOString(),
      photoUrl: `data:image/jpeg;base64,${input.photo}`,
    });
    item.status = "disponible";
    return { message: "Revisión registrada. Equipo disponible." };
  },
  maintenance: async () => {
    if (!canManage(signedIn().role)) throw new Error("Acceso no permitido.");
    return {
      equipment: equipment
        .filter((e) => e.status === "mantenimiento")
        .map((e) => {
          const latest = reservations
            .filter((r) => r.equipment.id === e.id && r.loan)
            .at(-1);
          return {
            ...e,
            loan: latest?.loan?.returnedAt ? latest.loan : null,
            loanId: latest?.loan?.id ?? null,
            requester: latest?.requester.name,
            reservationId: latest?.id,
          };
        }),
    };
  },
  loans: async () => ({
    reservations: reservations
      .filter(
        (r) =>
          r.status === "aceptado" &&
          (canManage(signedIn().role) || r.requester.id === signedIn().id),
      )
      .slice()
      .reverse()
      .map(presentReservation),
    serverNow: new Date().toISOString(),
  }),
  recordLoan: async (phase, input) => {
    const actor = signedIn();
    const row = reservations.find((r) => r.id === input.reservationId);
    if (
      !row ||
      (actor.role !== "administrador" &&
        (row.requester.id !== actor.id || !canRequestReservation(actor.role)))
    )
      throw new Error(
        "Solo el solicitante puede registrar el uso y devolución.",
      );
    if (
      !input.completeDeviceConfirmed ||
      typeof input.photo !== "string" ||
      !input.photo ||
      input.photo.length > 5592408
    )
      throw new Error(
        "La foto del equipo completo es obligatoria (máximo 4 MB).",
      );
    const now = new Date();
    if (phase === "inicio") {
      if (row.loan && !row.loan.returnedAt)
        return { loan: { reservationId: row.id, state: "en_uso" } };
      if (
        row.loan ||
        row.status !== "aceptado" ||
        (actor.role !== "administrador" && now < new Date(row.startsAt)) ||
        (actor.role !== "administrador" && now >= new Date(row.endsAt)) ||
        row.equipment.status !== "disponible"
      ) {
        const error = new Error(
          "No puedes iniciar: comprueba horario, aprobaciones y disponibilidad.",
        );
        error.status = 409;
        throw error;
      }
      row.loan = {
        id: row.id,
        startedAt: now.toISOString(),
        returnedAt: null,
        startPhotoUrl: `data:image/jpeg;base64,${input.photo}`,
        returnPhotoUrl: null,
      };
      row.equipment.status = "prestado";
    } else if (phase === "devolucion") {
      if (!row.loan) throw new Error("Primero debes iniciar el uso.");
      if (!row.loan.returnedAt) {
        row.loan.returnedAt = now.toISOString();
        row.loan.returnPhotoUrl = `data:image/jpeg;base64,${input.photo}`;
        if (row.equipment.status === "prestado")
          row.equipment.status = "mantenimiento";
      }
    } else throw new Error("Operación no válida.");
    return {
      loan: {
        reservationId: row.id,
        state: phase === "inicio" ? "en_uso" : "devuelto",
      },
    };
  },
  approvals: async () => {
    const actor = signedIn();
    const stage = approvalStages[actor.role];
    if (!stage) throw new Error("No tienes acceso a las aprobaciones.");
    const previous =
      actor.role === "administrador" ? "docente" : "jefe_laboratorio";
    return {
      reservations: reservations
        .filter((r) =>
          actor.role === "docente"
            ? r.teacher.id === actor.id
            : r.timeline.some(
                (s) => s.key === previous && s.state === "completado",
              ),
        )
        .slice()
        .reverse()
        .map((r) =>
          structuredClone({
            ...presentReservation(r),
            reviewStage: stage.key,
            canDecide:
              r.status === "en_revision" &&
              r.timeline.some((s) => s.key === stage.key && s.current),
          }),
        ),
    };
  },
  reviewReservation: async ({ reservationId, step, outcome, note }) => {
    const actor = signedIn();
    const stage = approvalStages[actor.role];
    if (!stage || stage.key !== step)
      throw new Error("Solo puedes decidir en tu fase.");
    const reservation = reservations.find((r) => r.id === reservationId);
    if (
      !reservation ||
      (actor.role === "docente" && reservation.teacher.id !== actor.id)
    )
      throw new Error("No tienes acceso a esta solicitud.");
    const event = reservation.timeline.find((s) => s.key === step);
    if (reservation.status !== "en_revision" || !event?.current) {
      const error = new Error(
        "La solicitud ya fue atendida o todavía no llegó a tu fase. Actualiza la bandeja.",
      );
      error.status = 409;
      throw error;
    }
    if (
      !["completado", "rechazado"].includes(outcome) ||
      typeof note !== "string" ||
      note.trim().length > 1000
    )
      throw new Error("La decisión o la observación no son válidas.");
    if (outcome === "rechazado" && !note.trim())
      throw new Error("Indica el motivo del rechazo.");
    if (
      outcome === "completado" &&
      (reservation.equipment.status !== "disponible" ||
        new Date(reservation.endsAt) <= new Date())
    )
      throw new Error(
        "El equipo no está disponible o el período solicitado ya terminó. Puedes rechazar indicando el motivo.",
      );
    Object.assign(event, {
      state: outcome,
      current: false,
      actor: actor.name,
      at: new Date().toISOString(),
      note: note.trim() || null,
    });
    reservation.status =
      outcome === "rechazado"
        ? "rechazado"
        : step === "encargado_laboratorio"
          ? "aceptado"
          : "en_revision";
    const next = reservation.timeline.find((s) => s.state === "pendiente");
    if (reservation.status === "en_revision" && next) next.current = true;
    return {
      reservation: { id: reservation.id, status: reservation.status, step },
    };
  },
  createReservation: async (input) => {
    const actor = signedIn();
    if (!canRequestReservation(actor.role))
      throw new Error("Las reservas las realizan estudiantes y docentes.");
    const previous = reservations.find(
      (r) => r.requester.id === actor.id && r.requestKey === input.requestKey,
    );
    if (previous) return { reservation: previous };
    const invalid = intervalError(input.startsAt, input.endsAt);
    if (invalid) throw new Error(invalid);
    const teacher = users.find(
      (u) => u.id === input.teacherId && u.role === "docente",
    );
    if (!teacher) throw new Error("Selecciona un docente responsable.");
    if (!input.purpose.trim())
      throw new Error("Escribe el motivo de la reserva.");
    const item = available(input).find((e) => e.id === input.equipmentId);
    if (!item) {
      const error = new Error(
        "El equipo ya no está disponible para ese horario.",
      );
      error.status = 409;
      throw error;
    }
    const id = reservations.length + 1,
      createdAt = new Date().toISOString();
    const reservation = {
      id,
      reference: `RES-${String(id).padStart(5, "0")}`,
      requester: actor,
      teacher,
      equipment: item,
      startsAt: campusDate(input.startsAt).toISOString(),
      endsAt: campusDate(input.endsAt).toISOString(),
      createdAt,
      purpose: input.purpose,
      status: "en_revision",
      requestKey: input.requestKey,
      timeline: reservationSteps.map(([key, label], index) => ({
        key,
        label,
        state: index === 0 ? "completado" : "pendiente",
        current: index === 1,
        at: index === 0 ? createdAt : null,
        actor: index === 0 ? actor.name : null,
        note: null,
      })),
    };
    reservations.push(reservation);
    return { reservation };
  },
};

const liveListeners = new Set();
demoApi.subscribeChanges = (onChange, onStatus) => {
  liveListeners.add(onChange);
  onStatus("connected");
  queueMicrotask(onChange);
  return () => liveListeners.delete(onChange);
};
for (const method of [
  "createEquipment",
  "updateEquipment",
  "disableEquipment",
  "createReservation",
  "reviewReservation",
  "recordLoan",
  "completeMaintenance",
]) {
  const original = demoApi[method];
  demoApi[method] = async (...args) => {
    const result = await original(...args);
    liveListeners.forEach((listener) => listener());
    return result;
  };
}
