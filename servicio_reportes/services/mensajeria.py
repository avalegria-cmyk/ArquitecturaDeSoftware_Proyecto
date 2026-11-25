"""Consumidor de RabbitMQ: guarda en la bitácora (audit_logs) los eventos de todos los servicios.

Los mensajes llegan a la cola durable `reportes.auditoria`. Si este servicio está apagado,
RabbitMQ los conserva y se procesan cuando vuelve (comunicación asíncrona).
"""
import asyncio
import json
import os
from datetime import datetime

import aio_pika

from config.database import SessionLocal
from models.auditoria import Auditoria

EXCHANGE = "uniequipos.eventos"
COLA = "reportes.auditoria"


def guardar(evento: dict) -> None:
    db = SessionLocal()
    try:
        creado = datetime.fromisoformat(evento["at"].replace("Z", "+00:00")).replace(tzinfo=None) if evento.get("at") else None
        db.add(Auditoria(user_id=int(evento["userId"]), action=str(evento["action"])[:100],
                         service=evento.get("service"), **({"created_at": creado} if creado else {})))
        db.commit()
    finally:
        db.close()


async def procesar(mensaje: aio_pika.abc.AbstractIncomingMessage) -> None:
    # Se confirma (ack) solo después de guardar; si falla, el mensaje vuelve a la cola.
    async with mensaje.process(requeue=True):
        evento = json.loads(mensaje.body)
        # Los cambios automáticos (sin usuario) solo interesan a Notificaciones.
        if evento.get("userId"):
            await asyncio.to_thread(guardar, evento)


async def consumir() -> None:
    url = os.getenv("RABBITMQ_URL")
    if not url:
        print("RABBITMQ_URL no configurada: la bitácora solo recibe eventos por /internal/audit.")
        return
    while True:
        try:
            conexion = await aio_pika.connect_robust(url)
            async with conexion:
                canal = await conexion.channel()
                await canal.set_qos(prefetch_count=20)
                exchange = await canal.declare_exchange(EXCHANGE, aio_pika.ExchangeType.TOPIC, durable=True)
                cola = await canal.declare_queue(COLA, durable=True)
                await cola.bind(exchange, routing_key="#")
                print(f"Escuchando eventos en la cola {COLA}")
                await cola.consume(procesar)
                await asyncio.Future()
        except asyncio.CancelledError:
            raise
        except Exception as error:
            print(f"RabbitMQ no disponible ({error}); reintento en 3 s")
            await asyncio.sleep(3)
