import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { noAutorizado } from '#exceptions/errores'

export type Rol = 'administrador' | 'encargado' | 'estudiante' | 'docente'
export interface Usuario {
  id: number
  role: Rol
  name: string
}

declare module '@adonisjs/core/http' {
  interface HttpContext {
    usuario: Usuario
  }
}

/** El gateway valida la cookie con Identidad y envía el usuario en cabeceras. */
export default class UsuarioMiddleware {
  handle(ctx: HttpContext, next: NextFn) {
    const id = Number(ctx.request.header('x-user-id'))
    const role = ctx.request.header('x-user-role') as Rol | undefined
    if (!Number.isInteger(id) || id < 1 || !role) {
      throw noAutorizado('La sesión terminó. Inicia sesión nuevamente.')
    }
    ctx.usuario = { id, role, name: decodeURIComponent(ctx.request.header('x-user-name') ?? '') }
    return next()
  }
}

export const puedeGestionarEquipos = (usuario: Usuario) =>
  usuario.role === 'administrador' || usuario.role === 'encargado'
