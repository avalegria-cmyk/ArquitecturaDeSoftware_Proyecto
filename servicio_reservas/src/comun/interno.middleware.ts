import { Injectable, NestMiddleware } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** Solo el API Gateway y los otros microservicios conocen el token interno. */
@Injectable()
export class InternoMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const esperado = Buffer.from(process.env.INTERNAL_TOKEN ?? '');
    const recibido = Buffer.from(req.header('x-internal-token') ?? '');
    if (!esperado.length || recibido.length !== esperado.length || !timingSafeEqual(recibido, esperado)) {
      res.status(403).json({ message: 'Acceso interno no autorizado.' });
      return;
    }
    next();
  }
}
