import { Exception } from '@adonisjs/core/exceptions'

/** Errores de negocio con el mismo código HTTP que usaba el monolito. */
export const invalido = (mensaje: string) => new Exception(mensaje, { status: 422, code: 'E_INVALIDO' })
export const prohibido = (mensaje: string) => new Exception(mensaje, { status: 403, code: 'E_PROHIBIDO' })
export const conflicto = (mensaje: string) => new Exception(mensaje, { status: 409, code: 'E_CONFLICTO' })
export const noEncontrado = (mensaje: string) => new Exception(mensaje, { status: 404, code: 'E_NO_ENCONTRADO' })
export const noAutorizado = (mensaje: string) => new Exception(mensaje, { status: 401, code: 'E_NO_AUTORIZADO' })
