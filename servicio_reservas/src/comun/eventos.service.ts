import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import amqp, { type Channel, type ChannelModel } from 'amqplib';

const EXCHANGE = 'uniequipos.eventos';

/**
 * Comunicación asíncrona con RabbitMQ: cada acción se publica como evento y no se espera respuesta.
 * Reportes la guarda en la bitácora y Notificaciones avisa a los navegadores.
 */
@Injectable()
export class EventosService implements OnModuleDestroy {
  private readonly logger = new Logger(EventosService.name);
  private conexion: ChannelModel | null = null;
  private canal: Promise<Channel> | null = null;

  private abrirCanal(): Promise<Channel> {
    this.canal ??= (async () => {
      const conexion = await amqp.connect(process.env.RABBITMQ_URL!);
      const reiniciar = () => {
        this.conexion = null;
        this.canal = null;
      };
      conexion.on('close', reiniciar);
      conexion.on('error', reiniciar);
      this.conexion = conexion;
      const canal = await conexion.createChannel();
      await canal.assertExchange(EXCHANGE, 'topic', { durable: true });
      return canal;
    })().catch((error) => {
      this.canal = null;
      throw error;
    });
    return this.canal;
  }

  /** Publica la acción (ej. reservation.submitted:3); la clave de ruteo es lo que va antes de ":". */
  publicar(accion: string, userId: number | null) {
    if (!process.env.RABBITMQ_URL) return;
    const evento = { userId, action: accion, service: 'reservas', at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') };
    this.abrirCanal()
      .then((c) => c.publish(EXCHANGE, accion.split(':')[0], Buffer.from(JSON.stringify(evento)), { persistent: true, contentType: 'application/json', appId: 'reservas' }))
      .catch((error) => this.logger.warn(`Evento pendiente, RabbitMQ no disponible: ${error.message} ${JSON.stringify(evento)}`));
  }

  async onModuleDestroy() {
    await this.conexion?.close().catch(() => undefined);
  }
}
