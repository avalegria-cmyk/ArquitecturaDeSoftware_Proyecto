import { invalido } from './errores.js';

/** El formulario envía fechas locales de Ecuador (UTC-5, sin horario de verano) como 2026-11-30T10:00. */
export function fechaLocal(valor: unknown, campo: string): Date {
  if (typeof valor !== 'string') throw invalido(`El campo ${campo} es obligatorio y debe ser texto.`);
  const texto = valor.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(texto);
  if (!m) throw invalido('Selecciona fechas y horas válidas en el calendario.');
  const [anio, mes, dia, hora, minuto] = m.slice(1).map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia, hora + 5, minuto));
  const local = new Date(fecha.getTime() - 5 * 3600_000);
  if (local.getUTCFullYear() !== anio || local.getUTCMonth() !== mes - 1 || local.getUTCDate() !== dia || local.getUTCHours() !== hora) {
    throw invalido('Selecciona fechas y horas válidas en el calendario.');
  }
  return fecha;
}

export interface Intervalo {
  inicio: Date;
  fin: Date;
}

export function intervalo(datos: Record<string, unknown>): Intervalo {
  const inicio = fechaLocal(datos.startsAt, 'startsAt');
  const fin = fechaLocal(datos.endsAt, 'endsAt');
  if (inicio >= fin) throw invalido('La fecha de fin debe ser posterior al inicio.');
  return { inicio, fin };
}

/** Formato de salida del monolito: 2026-11-30T15:00:00Z */
export const iso = (fecha: Date | string | null) =>
  fecha === null ? null : new Date(fecha).toISOString().replace(/\.\d{3}Z$/, 'Z');
