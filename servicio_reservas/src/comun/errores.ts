import { HttpException } from '@nestjs/common';

/** Mismos códigos HTTP que usaba el monolito para cada tipo de error. */
export const invalido = (m: string) => new HttpException({ message: m }, 422);
export const prohibido = (m: string) => new HttpException({ message: m }, 403);
export const conflicto = (m: string) => new HttpException({ message: m }, 409);
export const noEncontrado = (m: string) => new HttpException({ message: m }, 404);
export const noDisponible = (m: string) => new HttpException({ message: m }, 503);
