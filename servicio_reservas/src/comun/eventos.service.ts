import { Injectable, Logger } from '@nestjs/common';

/** Avisos sin esperar respuesta: bitácora a Reportes y cambio a Notificaciones. */
@Injectable()
export class EventosService {
  private readonly logger = new Logger(EventosService.name);

  private enviar(url: string | undefined, cuerpo: object) {
    if (!url) return;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': process.env.INTERNAL_TOKEN ?? '', 'X-Service': 'reservas' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(2000),
    }).catch((error) => this.logger.warn(`No se pudo avisar a ${url}: ${error.message} ${JSON.stringify(cuerpo)}`));
  }

  auditar(userId: number, action: string) {
    this.enviar(process.env.AUDIT_URL, { userId, action });
  }

  notificar(type = 'reservation.changed') {
    this.enviar(process.env.NOTIFY_URL, { type });
  }
}
