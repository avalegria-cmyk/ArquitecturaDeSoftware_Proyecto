import { timingSafeEqual } from 'node:crypto'
import env from '#start/env'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/** Rechaza cualquier petición que no venga del API Gateway o de otro microservicio. */
export default class InternoMiddleware {
  handle(ctx: HttpContext, next: NextFn) {
    const esperado = Buffer.from(env.get('INTERNAL_TOKEN').release())
    const recibido = Buffer.from(ctx.request.header('x-internal-token') ?? '')
    if (recibido.length !== esperado.length || !timingSafeEqual(recibido, esperado)) {
      return ctx.response.status(403).send({ message: 'Acceso interno no autorizado.' })
    }
    return next()
  }
}
