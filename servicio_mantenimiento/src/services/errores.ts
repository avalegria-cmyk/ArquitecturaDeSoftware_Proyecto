/** Error HTTP con el mensaje que muestra el frontend. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export const invalido = (m: string) => new HttpError(422, m);
export const prohibido = (m: string) => new HttpError(403, m);
export const noAutorizado = (m: string) => new HttpError(401, m);
export const noDisponible = (m: string) => new HttpError(503, m);
