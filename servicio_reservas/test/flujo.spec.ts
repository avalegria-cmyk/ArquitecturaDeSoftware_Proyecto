import { describe, expect, it } from 'vitest';
import { estadoResultante, faseDe, fasePendiente, linea, seCruzan, type Evento } from '../src/reservas/flujo.js';
import { fechaLocal } from '../src/comun/fechas.js';

const evento = (step: Evento['step'], outcome: Evento['outcome'] = 'completado'): Evento => ({ step, outcome, actor: 'x', at: '2026-01-01T00:00:00Z', note: null });

describe('flujo de aprobación', () => {
  it('después de enviar, la fase pendiente es la del docente', () => {
    expect(fasePendiente({ status: 'en_revision', events: [evento('enviado')] })).toBe('docente');
  });
  it('tras el docente sigue el jefe de laboratorio', () => {
    expect(fasePendiente({ status: 'en_revision', events: [evento('enviado'), evento('docente')] })).toBe('jefe_laboratorio');
  });
  it('un rechazo detiene la línea de tiempo', () => {
    const pasos = linea([evento('enviado'), evento('docente', 'rechazado')]);
    expect(pasos.filter((p) => p.current)).toHaveLength(0);
  });
  it('solo el encargado deja la reserva aceptada', () => {
    expect(estadoResultante('jefe_laboratorio', 'completado')).toBe('en_revision');
    expect(estadoResultante('encargado_laboratorio', 'completado')).toBe('aceptado');
    expect(estadoResultante('docente', 'rechazado')).toBe('rechazado');
  });
  it('el administrador atiende la fase de jefe y el estudiante no aprueba', () => {
    expect(faseDe('administrador')).toBe('jefe_laboratorio');
    expect(faseDe('estudiante')).toBeNull();
  });
});

describe('horarios', () => {
  it('intervalos semiabiertos: terminar a las 10 permite empezar a las 10', () => {
    const a = { inicio: fechaLocal('2026-12-01T08:00', 's'), fin: fechaLocal('2026-12-01T10:00', 'e') };
    const b = { inicio: fechaLocal('2026-12-01T10:00', 's'), fin: fechaLocal('2026-12-01T12:00', 'e') };
    expect(seCruzan(a, b)).toBe(false);
  });
  it('convierte la hora de Ecuador a UTC', () => {
    expect(fechaLocal('2026-12-01T08:00', 's').toISOString()).toBe('2026-12-01T13:00:00.000Z');
  });
  it('rechaza fechas imposibles', () => {
    expect(() => fechaLocal('2026-02-30T08:00', 's')).toThrow();
  });
});
