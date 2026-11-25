import asyncio
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException

from services import clientes


def ahora_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def estado_prestamo(prestamo: dict, fin_reservado: str | None, ahora: str) -> str:
    if prestamo["returnedAt"]:
        return "Devuelto"
    return "En uso · atrasado" if fin_reservado and fin_reservado < ahora else "En uso"


def componer(equipos: list, prestamos: list, revisiones: list, reservas: list, ahora: str) -> dict:
    """Une los datos de cuatro servicios (equivale a los JOIN del monolito)."""
    por_equipo = {e["id"]: e for e in equipos}
    por_reserva = {r["id"]: r for r in reservas}
    filas_equipo = []
    for e in sorted(equipos, key=lambda x: x["code"]):
        propios = [p for p in prestamos if p["equipmentId"] == e["id"]]
        filas_equipo.append({**e, "totalLoans": len(propios), "activeLoans": sum(1 for p in propios if p["returnedAt"] is None),
                             "totalReviews": sum(1 for r in revisiones if r["equipmentId"] == e["id"])})
    filas_prestamo = []
    for p in prestamos:
        reserva = por_reserva.get(p["reservationId"], {})
        equipo = por_equipo.get(p["equipmentId"]) or reserva.get("equipment", {})
        filas_prestamo.append({
            "id": p["id"], "equipmentId": p["equipmentId"], "code": equipo.get("code"), "name": equipo.get("name"),
            "reservationId": p["reservationId"], "requester": reserva.get("requester", {}).get("name", p.get("requesterName")),
            "email": reserva.get("requester", {}).get("email"), "teacher": reserva.get("teacher", {}).get("name"),
            "purpose": reserva.get("purpose"), "reservedStart": reserva.get("startsAt"), "reservedEnd": reserva.get("endsAt"),
            "startedAt": p["startedAt"], "returnedAt": p["returnedAt"], "state": estado_prestamo(p, reserva.get("endsAt"), ahora),
            "startPhotoUrl": f"/api/loans/{p['reservationId']}/photos/inicio",
            "returnPhotoUrl": f"/api/loans/{p['reservationId']}/photos/devolucion" if p["returnedAt"] else None,
        })
    filas_revision = [{"id": r["id"], "equipmentId": r["equipmentId"], "code": r["code"], "name": r["name"], "comments": r["comments"],
                       "reviewer": r["reviewer"], "reviewedAt": r["reviewedAt"], "photoUrl": r["photoUrl"]} for r in revisiones]
    return {"equipment": filas_equipo, "loans": filas_prestamo, "reviews": filas_revision, "generatedAt": ahora}


async def instantanea(equipment_id: int | None) -> dict:
    async with httpx.AsyncClient(timeout=5) as cliente:
        equipos, prestamos, revisiones = await asyncio.gather(
            clientes.equipos(cliente, equipment_id), clientes.prestamos(cliente, equipment_id), clientes.revisiones(cliente, equipment_id))
        if equipment_id is not None and not equipos:
            raise HTTPException(422, "El equipo no existe.")
        reservas = await clientes.reservas(cliente, sorted({p["reservationId"] for p in prestamos}))
    return componer(equipos, prestamos, revisiones, reservas, ahora_iso())
