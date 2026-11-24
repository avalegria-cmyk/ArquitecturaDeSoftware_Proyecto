import { Injectable } from '@nestjs/common';
import type pg from 'pg';
import { DbService } from '../db/db.service.js';
import type { Equipo } from '../comun/clientes.service.js';
import { iso } from '../comun/fechas.js';
import type { Evento } from './flujo.js';

export interface FilaReserva {
  id: string;
  requester_id: string;
  requester_name: string;
  requester_email: string;
  teacher_id: string;
  teacher_name: string;
  teacher_email: string;
  equipment_id: string;
  equipment_code: string;
  equipment_name: string;
  equipment_category: string;
  equipment_location: string;
  starts_at: Date;
  ends_at: Date;
  purpose: string;
  status: string;
  created_at: Date;
  loan_id: string | null;
  loan_started_at: Date | null;
  loan_returned_at: Date | null;
}

export interface Reserva {
  id: number;
  reference: string;
  requester: { id: number; name: string; email: string };
  teacher: { id: number; name: string; email: string };
  equipment: { id: number; name: string; code: string; category: string; location: string };
  startsAt: string;
  endsAt: string;
  createdAt: string;
  purpose: string;
  status: string;
  events: Evento[];
  equipmentStatus: string | null;
  loan: { id: number; startedAt: string; returnedAt: string | null; startPhotoUrl: string; returnPhotoUrl: string | null } | null;
}

type Ejecutor = Pick<pg.PoolClient, 'query'>;

/** Acceso a reservas_db con SQL directo (pg). */
@Injectable()
export class ReservasRepositorio {
  constructor(private readonly db: DbService) {}

  /** Lee reservas con sus eventos. `equipos` son los datos vivos del catálogo (o null si no respondió). */
  async historial(where: string, params: unknown[], equipos: (ids: number[]) => Promise<Map<number, Equipo> | null>, ejecutor: Ejecutor = this.db.pool, bloquear = false): Promise<Reserva[]> {
    const { rows } = await ejecutor.query<FilaReserva>(
      `SELECT r.* FROM reservations r WHERE ${where} ORDER BY r.created_at DESC, r.id DESC${bloquear ? ' FOR UPDATE' : ''}`,
      params,
    );
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const eventos = await ejecutor.query(
      'SELECT * FROM reservation_events WHERE reservation_id = ANY($1::bigint[]) ORDER BY created_at, id',
      [ids],
    );
    const porReserva = new Map<string, Evento[]>();
    for (const e of eventos.rows) {
      const lista = porReserva.get(e.reservation_id) ?? [];
      lista.push({ step: e.step, outcome: e.outcome, actor: e.actor_name, at: iso(e.created_at)!, note: e.note });
      porReserva.set(e.reservation_id, lista);
    }
    const vivos = await equipos([...new Set(rows.map((r) => Number(r.equipment_id)))]);
    return rows.map((r) => this.mapear(r, porReserva.get(r.id) ?? [], vivos?.get(Number(r.equipment_id)) ?? null));
  }

  private mapear(r: FilaReserva, events: Evento[], vivo: Equipo | null): Reserva {
    const id = Number(r.id);
    return {
      id,
      reference: `RES-${String(id).padStart(5, '0')}`,
      requester: { id: Number(r.requester_id), name: r.requester_name, email: r.requester_email },
      teacher: { id: Number(r.teacher_id), name: r.teacher_name, email: r.teacher_email },
      equipment: {
        id: Number(r.equipment_id),
        name: vivo?.name ?? r.equipment_name,
        code: vivo?.code ?? r.equipment_code,
        category: vivo?.category ?? r.equipment_category,
        location: vivo?.location ?? r.equipment_location,
      },
      startsAt: iso(r.starts_at)!,
      endsAt: iso(r.ends_at)!,
      createdAt: iso(r.created_at)!,
      purpose: r.purpose,
      status: r.status,
      events,
      equipmentStatus: vivo?.status ?? null,
      loan: r.loan_id
        ? {
            id: Number(r.loan_id),
            startedAt: iso(r.loan_started_at)!,
            returnedAt: iso(r.loan_returned_at),
            startPhotoUrl: `/api/loans/${id}/photos/inicio`,
            returnPhotoUrl: r.loan_returned_at ? `/api/loans/${id}/photos/devolucion` : null,
          }
        : null,
    };
  }

  /** Reservas que ocupan el equipo en ese intervalo (y cuyo préstamo no se devolvió). */
  async bloqueantes(ejecutor: Ejecutor, equipoId: number, inicio: Date, fin: Date) {
    const { rows } = await ejecutor.query(
      `SELECT starts_at, ends_at FROM reservations
       WHERE equipment_id = $1 AND status IN ('en_revision', 'aceptado') AND starts_at < $2 AND ends_at > $3
         AND loan_returned_at IS NULL FOR UPDATE`,
      [equipoId, fin, inicio],
    );
    return rows.map((r) => ({ inicio: new Date(r.starts_at), fin: new Date(r.ends_at) }));
  }

  async equiposOcupados(inicio: Date, fin: Date): Promise<Set<number>> {
    const { rows } = await this.db.query(
      `SELECT DISTINCT equipment_id FROM reservations
       WHERE status IN ('en_revision', 'aceptado') AND starts_at < $1 AND ends_at > $2 AND loan_returned_at IS NULL`,
      [fin, inicio],
    );
    return new Set(rows.map((r) => Number(r.equipment_id)));
  }

  async porClave(ejecutor: Ejecutor, solicitante: number, clave: string) {
    const { rows } = await ejecutor.query('SELECT id, status FROM reservations WHERE requester_id = $1 AND request_key = $2 FOR UPDATE', [solicitante, clave]);
    return rows[0] ? { id: Number(rows[0].id), status: rows[0].status as string } : null;
  }

  async crear(ejecutor: Ejecutor, datos: Record<string, unknown>) {
    const { rows } = await ejecutor.query(
      `INSERT INTO reservations (requester_id, requester_name, requester_email, teacher_id, teacher_name, teacher_email,
         equipment_id, equipment_code, equipment_name, equipment_category, equipment_location, starts_at, ends_at, purpose, request_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
      [datos.requesterId, datos.requesterName, datos.requesterEmail, datos.teacherId, datos.teacherName, datos.teacherEmail,
        datos.equipmentId, datos.equipmentCode, datos.equipmentName, datos.equipmentCategory, datos.equipmentLocation,
        datos.inicio, datos.fin, datos.purpose, datos.requestKey],
    );
    const id = Number(rows[0].id);
    await ejecutor.query(
      `INSERT INTO reservation_events (reservation_id, step, outcome, actor_id, actor_name) VALUES ($1, 'enviado', 'completado', $2, $3)`,
      [id, datos.requesterId, datos.requesterName],
    );
    return id;
  }

  async equipoDe(id: number): Promise<number | null> {
    const { rows } = await this.db.query('SELECT equipment_id FROM reservations WHERE id = $1', [id]);
    return rows[0] ? Number(rows[0].equipment_id) : null;
  }

  async registrarDecision(ejecutor: Ejecutor, id: number, actor: { id: number; name: string }, paso: string, resultado: string, nota: string, estado: string) {
    await ejecutor.query(
      'INSERT INTO reservation_events (reservation_id, step, outcome, actor_id, actor_name, note) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, paso, resultado, actor.id, actor.name, nota || null],
    );
    await ejecutor.query('UPDATE reservations SET status = $1 WHERE id = $2', [estado, id]);
  }

  async registrarPrestamo(id: number, prestamo: { loanId: number; startedAt: string; returnedAt: string | null }) {
    const r = await this.db.query(
      'UPDATE reservations SET loan_id = $1, loan_started_at = $2, loan_returned_at = $3 WHERE id = $4',
      [prestamo.loanId, prestamo.startedAt, prestamo.returnedAt, id],
    );
    return r.rowCount === 1;
  }
}
