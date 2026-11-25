import { HttpError, noDisponible } from "./errores";

/** Llamadas REST a Catálogo, Préstamos, Reportes y Notificaciones. */
const cabeceras = () => ({
  "Content-Type": "application/json",
  "X-Internal-Token": process.env.INTERNAL_TOKEN ?? "",
  "X-Service": "mantenimiento",
});

async function pedir<T>(url: string, servicio: string, init: RequestInit = {}): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(url, { ...init, headers: cabeceras(), signal: AbortSignal.timeout(3000) });
  } catch {
    throw noDisponible(`El servicio de ${servicio} no está disponible. Intenta nuevamente en unos segundos.`);
  }
  if (respuesta.status === 404 || respuesta.status === 409) {
    const cuerpo = (await respuesta.json().catch(() => ({}))) as { message?: string };
    throw new HttpError(respuesta.status === 404 ? 422 : 403, cuerpo.message ?? "La unidad cambió de estado.");
  }
  if (!respuesta.ok) throw noDisponible(`El servicio de ${servicio} no está disponible. Intenta nuevamente en unos segundos.`);
  return (await respuesta.json()) as T;
}

export interface Equipo { id: number; code: string; name: string; category: string; status: string; location: string; description: string }
export interface Prestamo { id: number; reservationId: number; equipmentId: number; requesterName: string; startedAt: string; returnedAt: string | null; active: boolean }

const catalogo = () => process.env.CATALOGO_URL ?? "http://catalogo:3002";
const prestamos = () => process.env.PRESTAMOS_URL ?? "http://prestamos:3004";

export const Catalogo = {
  enMantenimiento: async () => (await pedir<{ equipment: Equipo[] }>(`${catalogo()}/internal/equipment?status=mantenimiento`, "catálogo")).equipment,
  equipo: async (id: number) => (await pedir<{ equipment: Equipo }>(`${catalogo()}/internal/equipment/${id}`, "catálogo")).equipment,
  habilitar: (id: number) => pedir(`${catalogo()}/internal/equipment/${id}/available`, "catálogo", { method: "POST" }),
};

export const Prestamos = {
  ultimos: async (equipos: number[]) =>
    equipos.length ? (await pedir<{ loans: Prestamo[] }>(`${prestamos()}/internal/loans/latest?equipmentIds=${equipos.join(",")}`, "préstamos")).loans : [],
};
