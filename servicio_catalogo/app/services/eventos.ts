import amqp, { type Channel, type ChannelModel } from 'amqplib'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'

/**
 * Comunicación asíncrona: cada cambio se publica como evento en RabbitMQ
 * (exchange topic `uniequipos.eventos`). No se espera respuesta de nadie:
 * - Reportes lo guarda en la bitácora si trae userId.
 * - Notificaciones avisa a los navegadores por SSE.
 */
const EXCHANGE = 'uniequipos.eventos'
let conexion: ChannelModel | null = null
let canal: Promise<Channel> | null = null

function abrirCanal(): Promise<Channel> {
  canal ??= (async () => {
    conexion = await amqp.connect(env.get('RABBITMQ_URL')!)
    const reiniciar = () => {
      conexion = null
      canal = null
    }
    conexion.on('close', reiniciar)
    conexion.on('error', reiniciar)
    const nuevo = await conexion.createChannel()
    await nuevo.assertExchange(EXCHANGE, 'topic', { durable: true })
    return nuevo
  })().catch((error) => {
    canal = null
    throw error
  })
  return canal
}

/** Publica `accion` (por ejemplo equipment.updated:4). La clave de ruteo es la parte antes de ":". */
export function publicar(accion: string, userId: number | null) {
  if (!env.get('RABBITMQ_URL')) return
  const evento = { userId, action: accion, service: 'catalogo', at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') }
  abrirCanal()
    .then((c) =>
      c.publish(EXCHANGE, accion.split(':')[0], Buffer.from(JSON.stringify(evento)), {
        persistent: true,
        contentType: 'application/json',
        appId: 'catalogo',
      })
    )
    .catch((error) => logger.warn({ evento }, `Evento pendiente, RabbitMQ no disponible: ${error.message}`))
}
