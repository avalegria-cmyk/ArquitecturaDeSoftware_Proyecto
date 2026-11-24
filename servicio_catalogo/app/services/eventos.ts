import env from '#start/env'
import logger from '@adonisjs/core/services/logger'

/**
 * Comunicación con otros microservicios por REST (sin esperar respuesta):
 * - Reportes guarda la bitácora (audit_logs).
 * - Notificaciones avisa a los navegadores que algo cambió.
 */
async function enviar(url: string | undefined, cuerpo: object) {
  if (!url) return
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': env.get('INTERNAL_TOKEN').release(),
        'X-Service': 'catalogo',
      },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(2000),
    })
  } catch (error) {
    logger.warn({ url, cuerpo }, `No se pudo avisar: ${(error as Error).message}`)
  }
}

export function auditar(userId: number, action: string) {
  void enviar(env.get('AUDIT_URL'), { userId, action })
}

export function notificar(type = 'equipment.changed') {
  void enviar(env.get('NOTIFY_URL'), { type })
}
