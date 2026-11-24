import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreaker } from './circuit-breaker.js';
import { noDisponible } from './errores.js';

export interface Equipo {
  id: number;
  code: string;
  name: string;
  category: string;
  status: string;
  location: string;
  description: string;
}
export interface UsuarioPublico {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

/**
 * Comunicación síncrona (REST) con otros microservicios, como `servicio_factura`
 * en la práctica: Catálogo e Identidad. Cada destino tiene timeout, un reintento
 * y su propio Circuit Breaker.
 */
@Injectable()
export class ClientesService {
  private readonly logger = new Logger(ClientesService.name);
  private readonly catalogo = new CircuitBreaker('catalogo');
  private readonly identidad = new CircuitBreaker('identidad');

  private async get<T>(breaker: CircuitBreaker, url: string, servicio: string): Promise<T | null> {
    try {
      return await breaker.ejecutar(async () => {
        for (let intento = 1; ; intento++) {
          try {
            const respuesta = await fetch(url, {
              headers: { 'X-Internal-Token': process.env.INTERNAL_TOKEN ?? '', 'X-Service': 'reservas' },
              signal: AbortSignal.timeout(3000),
            });
            if (respuesta.status === 404) return null;
            if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
            return (await respuesta.json()) as T;
          } catch (error) {
            if (intento >= 2) throw error;
          }
        }
      });
    } catch (error) {
      this.logger.warn(`${servicio} no respondió: ${(error as Error).message}`);
      throw noDisponible(`El servicio de ${servicio} no está disponible. Intenta nuevamente en unos segundos.`);
    }
  }

  async equipo(id: number): Promise<Equipo | null> {
    const r = await this.get<{ equipment: Equipo }>(this.catalogo, `${process.env.CATALOGO_URL}/internal/equipment/${id}`, 'catálogo');
    return r?.equipment ?? null;
  }

  async equipos(filtro: { ids?: number[]; status?: string } = {}): Promise<Equipo[]> {
    const query = new URLSearchParams();
    if (filtro.ids) query.set('ids', filtro.ids.join(','));
    if (filtro.status) query.set('status', filtro.status);
    const r = await this.get<{ equipment: Equipo[] }>(this.catalogo, `${process.env.CATALOGO_URL}/internal/equipment?${query}`, 'catálogo');
    return r?.equipment ?? [];
  }

  /** Igual que `equipos`, pero si el catálogo falla devuelve null para usar la copia local. */
  async equiposOpcional(ids: number[]): Promise<Map<number, Equipo> | null> {
    if (!ids.length) return new Map();
    try {
      return new Map((await this.equipos({ ids })).map((e) => [e.id, e]));
    } catch {
      return null;
    }
  }

  async usuario(id: number): Promise<UsuarioPublico | null> {
    const r = await this.get<{ user: UsuarioPublico }>(this.identidad, `${process.env.IDENTIDAD_URL}/internal/users/${id}`, 'identidad');
    return r?.user ?? null;
  }

  async docentes(): Promise<{ id: number; name: string; email: string }[]> {
    const r = await this.get<{ teachers: { id: number; name: string; email: string }[] }>(this.identidad, `${process.env.IDENTIDAD_URL}/internal/teachers`, 'identidad');
    return r?.teachers ?? [];
  }
}
