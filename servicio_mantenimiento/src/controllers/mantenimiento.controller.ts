import { Revisiones } from "../models/revision.model";
import { Catalogo, Prestamos } from "../services/clientes";
import { publicar } from "../services/eventos";
import { invalido, prohibido } from "../services/errores";
import { decodificar, prepararFoto } from "../services/foto";

export interface Usuario { id: number; role: string; name: string }

const gestiona = (u: Usuario) => u.role === "administrador" || u.role === "encargado";
const iso = (fecha: Date) => fecha.toISOString().replace(/\.\d{3}Z$/, "Z");

export function autorizarRevision(u: Usuario) {
  if (!gestiona(u)) throw prohibido("Solo administrador y encargado pueden registrar revisiones.");
}

/** Equivale a MaintenanceReview del monolito: valida los datos de la revisión. */
export function validarRevision(datos: any): { equipmentId: number; loanId: number | null; comments: string; photo: string } {
  const id = (clave: string) => {
    const v = datos?.[clave];
    if (!Number.isInteger(v) || v < 1) throw invalido(`Selecciona un valor válido para ${clave}.`);
    return v as number;
  };
  const texto = (clave: string) => {
    if (typeof datos?.[clave] !== "string") throw invalido(`El campo ${clave} es obligatorio y debe ser texto.`);
    return (datos[clave] as string).trim();
  };
  const equipmentId = id("equipmentId");
  const loanId = datos?.loanId === undefined || datos?.loanId === null ? null : id("loanId");
  const comments = texto("comments");
  if (!comments || comments.length > 2000) throw invalido("Describe el estado y la revisión realizada (máximo 2000 caracteres).");
  return { equipmentId, loanId, comments, photo: texto("photo") };
}

/** GET /api/maintenance: unidades en revisión con su último préstamo (Catálogo + Préstamos). */
export async function pendientes(usuario: Usuario) {
  if (!gestiona(usuario)) throw prohibido("Solo administrador y encargado pueden consultar mantenimiento.");
  const equipos = await Catalogo.enMantenimiento();
  const ultimos = new Map((await Prestamos.ultimos(equipos.map((e) => e.id))).map((p) => [p.equipmentId, p]));
  const filas = equipos.map((e) => {
    const p = ultimos.get(e.id);
    const devuelto = p && p.returnedAt ? p : null;
    return {
      loanId: devuelto?.id ?? null, id: e.id, code: e.code, name: e.name, category: e.category,
      location: e.location, description: e.description,
      requester: devuelto?.requesterName ?? null, reservationId: devuelto?.reservationId ?? null,
      loan: devuelto ? {
        startedAt: devuelto.startedAt, returnedAt: devuelto.returnedAt,
        startPhotoUrl: `/api/loans/${devuelto.reservationId}/photos/inicio`,
        returnPhotoUrl: `/api/loans/${devuelto.reservationId}/photos/devolucion`,
      } : null,
    };
  });
  return filas.sort((a, b) => (b.loan?.returnedAt ?? "").localeCompare(a.loan?.returnedAt ?? "") || a.code.localeCompare(b.code));
}

/** POST /api/maintenance/complete: revisión con foto; el equipo vuelve a estar disponible. */
export async function completar(usuario: Usuario, datos: unknown) {
  const revision = validarRevision(datos);
  const bytes = decodificar(revision.photo, "La foto no es válida o supera 4 MB.");
  autorizarRevision(usuario);
  const foto = prepararFoto(bytes);
  const equipo = await Catalogo.equipo(revision.equipmentId);
  const [ultimo] = await Prestamos.ultimos([equipo.id]);
  if (equipo.status !== "mantenimiento" || (ultimo?.id ?? null) !== revision.loanId || ultimo?.active) {
    throw prohibido("La unidad cambió de estado o de préstamo. Cierra el detalle y consulta la información actualizada.");
  }
  const id = Revisiones.crear({
    equipment_id: equipo.id, equipment_code: equipo.code, equipment_name: equipo.name, loan_id: revision.loanId,
    reviewer_id: usuario.id, reviewer_name: usuario.name, comments: revision.comments, photo: foto, reviewed_at: iso(new Date()),
  });
  try {
    await Catalogo.habilitar(equipo.id);
  } catch (error) {
    // Compensación: si Catálogo no habilitó la unidad, la revisión no queda registrada.
    Revisiones.eliminar(id);
    throw error;
  }
  publicar(`equipment.maintenance.completed:${id}`, usuario.id);
  return { message: "Revisión registrada. Equipo disponible." };
}

/** GET /api/maintenance/reviews */
export function historial(usuario: Usuario) {
  autorizarRevision(usuario);
  return {
    reviews: Revisiones.todas().map((r) => ({
      id: r.id, code: r.equipment_code, name: r.equipment_name, comments: r.comments, reviewer: r.reviewer_name,
      reviewedAt: r.reviewed_at, photoUrl: `/api/maintenance/reviews/${r.id}/photo`,
    })),
  };
}

export function foto(usuario: Usuario, id: number) {
  autorizarRevision(usuario);
  return Revisiones.foto(id) ?? (() => { throw invalido("La foto no existe."); })();
}

/** GET /internal/reviews?equipmentId= (Reportes) */
export function internas(equipmentId?: number) {
  return {
    reviews: Revisiones.todas(equipmentId).map((r) => ({
      id: r.id, equipmentId: r.equipment_id, code: r.equipment_code, name: r.equipment_name, comments: r.comments,
      reviewer: r.reviewer_name, reviewedAt: r.reviewed_at, photoUrl: `/api/maintenance/reviews/${r.id}/photo`,
    })),
  };
}
