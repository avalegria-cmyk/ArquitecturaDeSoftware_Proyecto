import { errors as vineErrors } from '@vinejs/vine'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'

/** Todas las respuestas de error tienen la forma { message } que espera el frontend. */
export default class HttpExceptionHandler extends ExceptionHandler {
  async handle(error: unknown, ctx: HttpContext) {
    if (error instanceof vineErrors.E_VALIDATION_ERROR) {
      const mensaje = (error.messages as { message: string }[])[0]?.message
      return ctx.response.status(422).send({ message: mensaje ?? 'Datos no válidos.' })
    }
    const status = (error as { status?: number }).status ?? 500
    if (status >= 500) {
      ctx.logger.error({ err: error }, 'Error no controlado')
      return ctx.response
        .status(500)
        .send({ message: 'No se pudo completar la solicitud. Revisa la conexión del servidor.' })
    }
    const code = (error as { code?: string }).code
    const mensaje = code === 'E_ROUTE_NOT_FOUND' ? 'Ruta no encontrada.' : (error as Error).message
    return ctx.response.status(status).send({ message: mensaje })
  }

  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
