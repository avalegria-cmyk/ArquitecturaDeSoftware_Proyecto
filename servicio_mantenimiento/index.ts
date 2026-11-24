import fastify from "fastify";
import "./src/config/database";
import { mantenimientoRouter } from "./src/router/mantenimiento.router";
import { HttpError } from "./src/services/errores";

const app = fastify({ logger: true, bodyLimit: 8 * 1024 * 1024 });

// Todas las respuestas de error tienen la forma { message } que espera el frontend.
app.setErrorHandler((error: Error & { statusCode?: number }, req, res) => {
  if (error instanceof HttpError) return res.code(error.status).send({ message: error.message });
  if (error.statusCode && error.statusCode < 500) return res.code(error.statusCode).send({ message: error.message });
  req.log.error(error);
  return res.code(500).send({ message: "No se pudo completar la solicitud. Revisa la conexión del servidor." });
});
app.setNotFoundHandler((_, res) => res.code(404).send({ message: "Ruta no encontrada." }));

app.register(mantenimientoRouter);

try {
  const puerto = Number(process.env.PORT) || 3005;
  await app.listen({ port: puerto, host: "0.0.0.0" });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
