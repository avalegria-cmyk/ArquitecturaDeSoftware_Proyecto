import amqp, { type Channel } from "amqplib";

/**
 * Comunicación asíncrona: publica cada acción en RabbitMQ (exchange `uniequipos.eventos`).
 * Reportes la guarda en la bitácora y Notificaciones avisa a los navegadores.
 */
const EXCHANGE = "uniequipos.eventos";
let canal: Promise<Channel> | null = null;

function abrirCanal(): Promise<Channel> {
  canal ??= (async () => {
    const conexion = await amqp.connect(process.env.RABBITMQ_URL!);
    const reiniciar = () => { canal = null; };
    conexion.on("close", reiniciar);
    conexion.on("error", reiniciar);
    const nuevo = await conexion.createChannel();
    await nuevo.assertExchange(EXCHANGE, "topic", { durable: true });
    return nuevo;
  })().catch((error) => {
    canal = null;
    throw error;
  });
  return canal;
}

export function publicar(accion: string, userId: number | null) {
  if (!process.env.RABBITMQ_URL) return;
  const evento = { userId, action: accion, service: "mantenimiento", at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z") };
  abrirCanal()
    .then((c) => c.publish(EXCHANGE, accion.split(":")[0]!, Buffer.from(JSON.stringify(evento)), { persistent: true, contentType: "application/json", appId: "mantenimiento" }))
    .catch((error) => console.warn(`Evento pendiente, RabbitMQ no disponible: ${error.message}`, evento));
}
