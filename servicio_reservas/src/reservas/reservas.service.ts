import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service.js';
import { ClientesService } from '../comun/clientes.service.js';
import { EventosService } from '../comun/eventos.service.js';
import { conflicto, invalido, prohibido } from '../comun/errores.js';
import { intervalo, iso } from '../comun/fechas.js';
import type { Usuario } from '../comun/usuario.js';
import { estadoResultante, faseDe, fasePendiente, linea, seCruzan, type Fase } from './flujo.js';
import { ReservasRepositorio, type Reserva } from './reservas.repositorio.js';

type Datos = Record<string, unknown>;

function id(datos: Datos, clave: string): number {
  const valor = datos[clave];
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 1) throw invalido(`Selecciona un valor válido para ${clave}.`);
  return valor;
}

function texto(datos: Datos, clave: string): string {
  const valor = datos[clave];
  if (typeof valor !== 'string') throw invalido(`El campo ${clave} es obligatorio y debe ser texto.`);
  return valor.trim();
}

const conLinea = ({ events, ...reserva }: Reserva) => ({ ...reserva, timeline: linea(events) });

@Injectable()
export class ReservasService {
  constructor(
    private readonly db: DbService,
    private readonly repo: ReservasRepositorio,
    private readonly clientes: ClientesService,
    private readonly eventos: EventosService,
  ) {}

  private vivos = (ids: number[]) => this.clientes.equiposOpcional(ids);

  async historial(usuario: Usuario) {
    const reservas = await this.repo.historial('r.requester_id = $1', [usuario.id], this.vivos);
    return { reservations: reservas.map(conLinea), serverNow: iso(new Date()) };
  }

  async docentes() {
    return { teachers: (await this.clientes.docentes()).map(({ id, name }) => ({ id, name })) };
  }

  async disponibilidad(consulta: Datos) {
    const hayIntervalo = consulta.startsAt !== undefined || consulta.endsAt !== undefined;
    const equipos = await this.clientes.equipos({ status: 'disponible' });
    if (!hayIntervalo) return { equipment: equipos.map((e) => ({ ...e, images: [] })), intervalChecked: false };
    const { inicio, fin } = intervalo(consulta);
    if (inicio <= new Date()) throw invalido('Selecciona una fecha y hora de inicio futuras.');
    const ocupados = await this.repo.equiposOcupados(inicio, fin);
    return { equipment: equipos.filter((e) => !ocupados.has(e.id)).map((e) => ({ ...e, images: [] })), intervalChecked: true };
  }

  /** Crear reserva: valida equipo (Catálogo), docente (Identidad) y choque de horarios. */
  async crear(usuario: Usuario, datos: Datos) {
    if (usuario.role !== 'estudiante' && usuario.role !== 'docente') {
      throw prohibido('Las reservas las realizan estudiantes y docentes desde su cuenta.');
    }
    const equipmentId = id(datos, 'equipmentId');
    const teacherId = id(datos, 'teacherId');
    const { inicio, fin } = intervalo(datos);
    const purpose = texto(datos, 'purpose');
    const requestKey = texto(datos, 'requestKey');
    if (!purpose || purpose.length > 1000) throw invalido('Indica el motivo de la reserva, con un máximo de 1000 caracteres.');
    if (!/^[a-f0-9-]{36}$/.test(requestKey)) throw invalido('Identificador de solicitud inválido. Vuelve a abrir el formulario.');

    const resultado = await this.db.transaccion(async (cx) => {
      // Bloqueo por equipo: dos solicitudes del mismo equipo se atienden una tras otra.
      await cx.query('SELECT pg_advisory_xact_lock($1)', [equipmentId]);
      const equipo = await this.clientes.equipo(equipmentId);
      if (!equipo) throw invalido('El equipo seleccionado no existe.');
      const existente = await this.repo.porClave(cx, usuario.id, requestKey);
      if (existente) return { reserva: existente, nueva: false };
      if (inicio <= new Date()) throw invalido('La fecha y hora de inicio deben ser posteriores al momento actual.');
      const docente = await this.clientes.usuario(teacherId);
      if (!docente || !docente.active || docente.role !== 'docente') throw invalido('Selecciona un docente responsable activo.');
      const ocupado = (await this.repo.bloqueantes(cx, equipmentId, inicio, fin)).some((s) => seCruzan({ inicio, fin }, s));
      if (equipo.status !== 'disponible' || ocupado) {
        throw conflicto('El equipo ya no está disponible para ese horario. Actualiza la disponibilidad y selecciona otro equipo o intervalo.');
      }
      const nuevo = await this.repo.crear(cx, {
        requesterId: usuario.id, requesterName: usuario.name, requesterEmail: usuario.email,
        teacherId, teacherName: docente.name, teacherEmail: docente.email,
        equipmentId, equipmentCode: equipo.code, equipmentName: equipo.name,
        equipmentCategory: equipo.category, equipmentLocation: equipo.location,
        inicio, fin, purpose, requestKey,
      });
      return { reserva: { id: nuevo, status: 'en_revision' }, nueva: true };
    });
    if (resultado.nueva) {
      this.eventos.auditar(usuario.id, `reservation.submitted:${resultado.reserva.id}`);
      this.eventos.notificar();
    }
    return { reservation: resultado.reserva, message: 'Reserva enviada. Está en revisión, pendiente del docente responsable.' };
  }

  /** Bandeja de aprobaciones según la fase del rol. */
  async bandeja(usuario: Usuario) {
    const fase = faseDe(usuario.role);
    if (!fase) throw prohibido('No tienes acceso a las aprobaciones.');
    const reservas =
      fase === 'docente'
        ? await this.repo.historial('r.teacher_id = $1', [usuario.id], this.vivos)
        : await this.repo.historial(
            `EXISTS (SELECT 1 FROM reservation_events prior WHERE prior.reservation_id = r.id AND prior.step = $1 AND prior.outcome = 'completado')`,
            [fase === 'jefe_laboratorio' ? 'docente' : 'jefe_laboratorio'],
            this.vivos,
          );
    return {
      reservations: reservas.map((r) => ({ ...conLinea(r), canDecide: fasePendiente(r) === fase, reviewStage: fase })),
    };
  }

  /** Registrar la decisión de una fase (aprobar o rechazar). */
  async decidir(usuario: Usuario, datos: Datos) {
    const paso = texto(datos, 'step');
    const resultado = texto(datos, 'outcome');
    const nota = texto(datos, 'note');
    if (!['docente', 'jefe_laboratorio', 'encargado_laboratorio'].includes(paso) || !['completado', 'rechazado'].includes(resultado)) {
      throw invalido('Selecciona una etapa y una decisión válidas.');
    }
    if (nota.length > 1000) throw invalido('La observación admite hasta 1000 caracteres.');
    if (resultado === 'rechazado' && !nota) throw invalido('Indica el motivo del rechazo.');
    const reservaId = id(datos, 'reservationId');
    const fase = faseDe(usuario.role);
    if (!fase) throw prohibido('No tienes acceso a las aprobaciones.');
    if (fase !== paso) throw prohibido('No puedes decidir una fase asignada a otro rol.');

    const equipoId = await this.repo.equipoDe(reservaId);
    if (!equipoId) throw conflicto('La solicitud ya no está disponible. Actualiza la bandeja.');
    const estado = await this.db.transaccion(async (cx) => {
      await cx.query('SELECT pg_advisory_xact_lock($1)', [equipoId]);
      const [reserva] = await this.repo.historial('r.id = $1', [reservaId], async (ids) => this.clientes.equiposOpcional(ids), cx, true);
      if (!reserva) throw conflicto('La solicitud ya no está disponible. Actualiza la bandeja.');
      if (fase === 'docente' && reserva.teacher.id !== usuario.id) throw prohibido('Solo el responsable de esta fase puede registrar la decisión.');
      if (fasePendiente(reserva) !== fase) throw conflicto('La solicitud ya fue atendida o todavía no llegó a tu fase. Actualiza la bandeja.');
      if (resultado === 'completado') {
        const equipo = await this.clientes.equipo(reserva.equipment.id);
        if (equipo?.status !== 'disponible') throw conflicto('El equipo ya no está habilitado para préstamo. Puedes rechazar la solicitud indicando el motivo.');
        if (new Date(reserva.endsAt) <= new Date()) throw conflicto('El período solicitado ya terminó. Puedes rechazar la solicitud indicando el motivo.');
      }
      const nuevo = estadoResultante(fase as Fase, resultado as 'completado' | 'rechazado');
      await this.repo.registrarDecision(cx, reservaId, usuario, paso, resultado, nota, nuevo);
      return nuevo;
    });
    this.eventos.auditar(usuario.id, `reservation.${resultado}:${reservaId}:${paso}`);
    this.eventos.notificar();
    return { reservation: { id: reservaId, status: estado, step: paso } };
  }

  // --- API interna (Préstamos y Reportes) ---

  async porId(reservaId: number) {
    const [reserva] = await this.repo.historial('r.id = $1', [reservaId], this.vivos);
    return reserva ? { reservation: conLinea(reserva) } : null;
  }

  async lista(consulta: Datos) {
    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (typeof consulta.status === 'string') {
      params.push(consulta.status);
      condiciones.push(`r.status = $${params.length}`);
    }
    if (consulta.requesterId) {
      params.push(Number(consulta.requesterId));
      condiciones.push(`r.requester_id = $${params.length}`);
    }
    if (typeof consulta.ids === 'string') {
      params.push(consulta.ids.split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0));
      condiciones.push(`r.id = ANY($${params.length}::bigint[])`);
    }
    const reservas = await this.repo.historial(condiciones.join(' AND ') || 'TRUE', params, this.vivos);
    return { reservations: reservas.map(conLinea) };
  }

  async registrarPrestamo(reservaId: number, datos: Datos) {
    const loanId = id(datos, 'loanId');
    const startedAt = typeof datos.startedAt === 'string' ? datos.startedAt : null;
    const returnedAt = typeof datos.returnedAt === 'string' ? datos.returnedAt : null;
    if (!startedAt) throw invalido('Indica el inicio del préstamo.');
    return this.repo.registrarPrestamo(reservaId, { loanId, startedAt, returnedAt });
  }

}
