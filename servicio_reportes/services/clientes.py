"""Composición de APIs: Reportes pide los datos a cada servicio por REST (no hay JOIN entre bases)."""
import os

import httpx
from fastapi import HTTPException


def _url(variable: str, defecto: str) -> str:
    return os.getenv(variable, defecto)


async def _get(cliente: httpx.AsyncClient, url: str, servicio: str, clave: str, params: dict | None = None) -> list:
    try:
        respuesta = await cliente.get(url, params=params, headers={"X-Internal-Token": os.getenv("INTERNAL_TOKEN", ""), "X-Service": "reportes"})
        respuesta.raise_for_status()
        return respuesta.json()[clave]
    except (httpx.HTTPError, KeyError, ValueError):
        raise HTTPException(503, f"El servicio de {servicio} no está disponible. Intenta nuevamente en unos segundos.")


async def equipos(cliente, equipment_id: int | None):
    params = {"ids": str(equipment_id)} if equipment_id else None
    return await _get(cliente, f"{_url('CATALOGO_URL', 'http://catalogo:3002')}/internal/equipment", "catálogo", "equipment", params)


async def prestamos(cliente, equipment_id: int | None):
    params = {"equipmentId": str(equipment_id)} if equipment_id else None
    return await _get(cliente, f"{_url('PRESTAMOS_URL', 'http://prestamos:3004')}/internal/loans", "préstamos", "loans", params)


async def revisiones(cliente, equipment_id: int | None):
    params = {"equipmentId": str(equipment_id)} if equipment_id else None
    return await _get(cliente, f"{_url('MANTENIMIENTO_URL', 'http://mantenimiento:3005')}/internal/reviews", "mantenimiento", "reviews", params)


async def reservas(cliente, ids: list[int]):
    if not ids:
        return []
    return await _get(cliente, f"{_url('RESERVAS_URL', 'http://reservas:3003')}/internal/reservations", "reservas", "reservations",
                      {"ids": ",".join(map(str, ids))})

