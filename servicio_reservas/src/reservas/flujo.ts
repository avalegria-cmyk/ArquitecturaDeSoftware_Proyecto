/**
 * Reglas del flujo de aprobación (Domain/Reservations del monolito).
 * Funciones puras: no dependen de la base ni de la red, por eso se prueban fácilmente.
 */
import type { Rol } from '../comun/usuario.js';

export const PASOS = {
  enviado: 'Enviado',
  docente: 'Aceptado por docente responsable',
  jefe_laboratorio: 'Aceptado por jefe de laboratorio',
  encargado_laboratorio: 'Aceptado por encargado de laboratorio',
} as const;
export type Paso = keyof typeof PASOS;
export type Fase = Exclude<Paso, 'enviado'>;
export const ESTADO_INICIAL = 'en_revision';
export const ESTADOS_BLOQUEANTES = ['en_revision', 'aceptado'];

export interface Evento {
  step: Paso;
  outcome: 'completado' | 'rechazado';
  actor: string;
  at: string;
  note: string | null;
}

export function linea(eventos: Evento[]) {
  let esperando = false;
  let rechazado = false;
  return (Object.keys(PASOS) as Paso[]).map((key) => {
    const evento = eventos.find((e) => e.step === key);
    const state = evento?.outcome ?? 'pendiente';
    const current = !esperando && !rechazado && state === 'pendiente';
    if (state !== 'completado') esperando = true;
    if (state === 'rechazado') rechazado = true;
    return { key, label: PASOS[key], state, current, at: evento?.at ?? null, actor: evento?.actor ?? null, note: evento?.note ?? null };
  });
}

/** Mientras no exista un rol de jefe, el administrador atiende esa fase. */
export function faseDe(rol: Rol): Fase | null {
  return rol === 'docente' ? 'docente' : rol === 'administrador' ? 'jefe_laboratorio' : rol === 'encargado' ? 'encargado_laboratorio' : null;
}

export function fasePendiente(reserva: { status: string; events: Evento[] }): Paso | null {
  if (reserva.status !== ESTADO_INICIAL) return null;
  return linea(reserva.events).find((p) => p.current)?.key ?? null;
}

export function estadoResultante(fase: Fase, decision: 'completado' | 'rechazado') {
  if (decision === 'rechazado') return 'rechazado';
  return fase === 'encargado_laboratorio' ? 'aceptado' : 'en_revision';
}

/** Intervalos semiabiertos: devolver a las 10 permite una reserva desde las 10. */
export const seCruzan = (a: { inicio: Date; fin: Date }, b: { inicio: Date; fin: Date }) => a.inicio < b.fin && a.fin > b.inicio;
