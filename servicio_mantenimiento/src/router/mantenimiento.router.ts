import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import * as controlador from "../controllers/mantenimiento.controller";
import { noAutorizado } from "../services/errores";

/** Solo el API Gateway y los otros microservicios conocen el token interno. */
function esInterno(req: FastifyRequest) {
  const esperado = Buffer.from(process.env.INTERNAL_TOKEN ?? "");
  const recibido = Buffer.from(String(req.headers["x-internal-token"] ?? ""));
  return esperado.length > 0 && recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}

/** Usuario que el gateway ya validó con Identidad. */
function usuario(req: FastifyRequest): controlador.Usuario {
  const id = Number(req.headers["x-user-id"]);
  const role = String(req.headers["x-user-role"] ?? "");
  if (!Number.isInteger(id) || id < 1 || !role) throw noAutorizado("La sesión terminó. Inicia sesión nuevamente.");
  return { id, role, name: decodeURIComponent(String(req.headers["x-user-name"] ?? "")) };
}

export const mantenimientoRouter = (app: FastifyInstance) => {
  app.addHook("onRequest", async (req, res) => {
    if (req.url !== "/health" && !esInterno(req)) return res.code(403).send({ message: "Acceso interno no autorizado." });
  });

  app.get("/health", async () => ({ status: "ok", service: "mantenimiento" }));

  app.get("/api/maintenance", async (req) => ({ equipment: await controlador.pendientes(usuario(req)) }));

  app.post("/api/maintenance/complete", async (req) => controlador.completar(usuario(req), req.body));

  app.get("/api/maintenance/reviews", async (req) => controlador.historial(usuario(req)));

  app.get<{ Params: { id: string } }>("/api/maintenance/reviews/:id/photo", async (req, res) => {
    const bytes = controlador.foto(usuario(req), Number(req.params.id));
    return res.header("Content-Type", "image/jpeg").header("Cache-Control", "private, no-store")
      .header("X-Content-Type-Options", "nosniff").send(Buffer.from(bytes));
  });

  app.get<{ Querystring: { equipmentId?: string } }>("/internal/reviews", async (req) =>
    controlador.internas(req.query.equipmentId ? Number(req.query.equipmentId) : undefined));
};
