import { createParamDecorator, ExecutionContext, HttpException } from '@nestjs/common';
import type { Request } from 'express';

export type Rol = 'administrador' | 'encargado' | 'estudiante' | 'docente';
export interface Usuario {
  id: number;
  role: Rol;
  name: string;
  email: string;
}

/** Usuario que el API Gateway ya validó con Identidad (cabeceras X-User-*). */
export const UsuarioActual = createParamDecorator((_: unknown, ctx: ExecutionContext): Usuario => {
  const req = ctx.switchToHttp().getRequest<Request>();
  const id = Number(req.header('x-user-id'));
  const role = req.header('x-user-role') as Rol | undefined;
  if (!Number.isInteger(id) || id < 1 || !role) {
    throw new HttpException({ message: 'La sesión terminó. Inicia sesión nuevamente.' }, 401);
  }
  return {
    id,
    role,
    name: decodeURIComponent(req.header('x-user-name') ?? ''),
    email: decodeURIComponent(req.header('x-user-email') ?? ''),
  };
});

export const puedeGestionarEquipos = (u: Usuario) => u.role === 'administrador' || u.role === 'encargado';
