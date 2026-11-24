import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';

/** Todas las respuestas de error tienen la forma { message } que espera el frontend. */
@Catch()
export class ErroresFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errores');

  catch(error: unknown, host: ArgumentsHost) {
    const respuesta = host.switchToHttp().getResponse<Response>();
    if (error instanceof HttpException) {
      const cuerpo = error.getResponse();
      const mensaje = typeof cuerpo === 'string' ? cuerpo : (cuerpo as { message?: unknown }).message;
      const status = error.getStatus();
      respuesta.status(status).json({ message: status === 404 && Array.isArray(mensaje) ? 'Ruta no encontrada.' : typeof mensaje === 'string' ? mensaje : 'Solicitud no válida.' });
      return;
    }
    const codigo = (error as { code?: string }).code;
    // Choques de concurrencia en PostgreSQL (clave única o bloqueo mutuo)
    if (codigo === '23505' || codigo === '40P01' || codigo === '40001') {
      respuesta.status(409).json({ message: 'Otra solicitud se procesó al mismo tiempo. Actualiza la disponibilidad y vuelve a intentarlo.' });
      return;
    }
    this.logger.error(error);
    respuesta.status(500).json({ message: 'No se pudo completar la solicitud. Revisa la conexión del servidor.' });
  }
}
