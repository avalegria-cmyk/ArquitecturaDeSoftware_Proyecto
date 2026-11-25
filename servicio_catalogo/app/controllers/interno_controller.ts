import type { HttpContext } from '@adonisjs/core/http'
import { Equipo, publico, type EquipoDoc, type Estado } from '#models/equipo'
import { conflicto, noEncontrado } from '#exceptions/errores'
import { estadoTrasDevolucion } from '#services/estado_equipo'
import { publicar } from '#services/eventos'

/**
 * API interna del catálogo. Los demás servicios no tocan la base de MongoDB:
 * piden los datos y los cambios de estado por aquí (Database per Service).
 */
export default class InternoController {
  /** GET /internal/equipment?ids=1,2&status=disponible */
  async index({ request }: HttpContext) {
    const filtro: Record<string, unknown> = {}
    const ids = String(request.input('ids', '')).split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0)
    if (ids.length) filtro.id = { $in: ids }
    if (request.input('status')) filtro.status = String(request.input('status'))
    const equipos = await Equipo.find(filtro).sort({ category: 1, name: 1, code: 1 }).lean<EquipoDoc[]>()
    return { equipment: equipos.map(publico) }
  }

  async show({ params }: HttpContext) {
    return { equipment: publico(await buscar(Number(params.id))) }
  }

  /** Préstamos inicia el uso: solo una unidad disponible puede pasar a prestada (operación atómica). */
  async loaned({ params }: HttpContext) {
    return cambiar(Number(params.id), 'disponible', 'prestado',
      'Esta unidad todavía no está disponible. Puede seguir en uso o estar en mantenimiento.')
  }

  /** Compensación (saga): Préstamos no pudo guardar el inicio, la unidad vuelve a estar disponible. */
  async release({ params }: HttpContext) {
    return cambiar(Number(params.id), 'prestado', 'disponible', 'La unidad ya no está prestada.')
  }

  /** Préstamos registra la devolución: la unidad pasa a revisión. */
  async returned({ params }: HttpContext) {
    const actual = await buscar(Number(params.id))
    return cambiar(actual.id, actual.status, estadoTrasDevolucion(actual.status),
      'La unidad cambió de estado. Vuelve a intentarlo.')
  }

  /** Mantenimiento terminó la revisión: la unidad vuelve a estar disponible. */
  async available({ params }: HttpContext) {
    return cambiar(Number(params.id), 'mantenimiento', 'disponible',
      'La unidad cambió de estado o de préstamo. Cierra el detalle y consulta la información actualizada.')
  }
}

async function buscar(id: number): Promise<EquipoDoc> {
  const equipo = await Equipo.findOne({ id }).lean<EquipoDoc>()
  if (!equipo) throw noEncontrado('El equipo no existe.')
  return equipo
}

async function cambiar(id: number, desde: Estado, hacia: Estado, mensaje: string) {
  const equipo = await Equipo.findOneAndUpdate({ id, status: desde }, { $set: { status: hacia } }, { returnDocument: 'after' }).lean<EquipoDoc>()
  if (!equipo) {
    await buscar(id)
    throw conflicto(mensaje)
  }
  // Cambio automático (sin usuario): solo lo usa Notificaciones.
  if (desde !== hacia) publicar(`equipment.status:${id}`, null)
  return { equipment: publico(equipo) }
}
