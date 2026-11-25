import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

/** Conexión a reservas_db. Crea las tablas al arrancar y ofrece transacciones. */
@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbService.name);
  readonly pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });

  async onModuleInit() {
    const esquema = await readFile(new URL('./esquema.sql', import.meta.url), 'utf8');
    for (let intento = 1; ; intento++) {
      try {
        await this.pool.query(esquema);
        this.logger.log('Esquema de reservas_db listo');
        return;
      } catch (error) {
        if (intento >= 30) throw error;
        this.logger.warn('Esperando a PostgreSQL...');
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  query<T extends pg.QueryResultRow = any>(sql: string, params: unknown[] = []) {
    return this.pool.query<T>(sql, params);
  }

  async transaccion<T>(operacion: (cliente: pg.PoolClient) => Promise<T>): Promise<T> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const resultado = await operacion(cliente);
      await cliente.query('COMMIT');
      return resultado;
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }
}
