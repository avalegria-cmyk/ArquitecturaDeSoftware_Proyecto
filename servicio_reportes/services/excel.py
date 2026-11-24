"""Exporta el reporte a Excel con las mismas hojas y columnas que el monolito."""
from datetime import datetime, timedelta, timezone
from io import BytesIO

from openpyxl import Workbook

ECUADOR = timezone(timedelta(hours=-5))
ESTADOS = {"disponible": "Disponible", "prestado": "En préstamo", "mantenimiento": "En mantenimiento",
           "fuera_servicio": "Fuera de servicio", "deshabilitado": "Deshabilitado"}


def fecha(valor: str | None) -> str:
    if not valor:
        return ""
    return datetime.fromisoformat(valor.replace("Z", "+00:00")).astimezone(ECUADOR).strftime("%d/%m/%Y %H:%M:%S")


def exportar(reporte: dict) -> bytes:
    hojas = {
        "Equipos": [["Código", "Equipo", "Categoría", "Ubicación", "Estado actual", "Veces prestado", "Préstamos activos", "Revisiones completadas"]],
        "Préstamos": [["Código", "Equipo", "Reserva", "Solicitante", "Correo", "Docente responsable", "Motivo", "Inicio reservado (Ecuador)",
                       "Fin reservado (Ecuador)", "Inicio real (Ecuador)", "Devolución real (Ecuador)", "Estado"]],
        "Revisiones": [["Código", "Equipo", "Revisado por", "Fecha (Ecuador)", "Comentarios"]],
        "Información": [["Dato", "Valor"], ["Generado (Ecuador)", fecha(reporte["generatedAt"])],
                        ["Conteo", "Veces prestado cuenta préstamos iniciados, incluidos activos y pruebas del administrador; no reservas sin retiro."],
                        ["Alcance", f"Equipos incluidos: {len(reporte['equipment'])}"],
                        ["Fotos", "Las evidencias se consultan dentro del sistema con sesión; no se incluyen imágenes en el Excel."]],
    }
    for e in reporte["equipment"]:
        hojas["Equipos"].append([e["code"], e["name"], e["category"], e["location"], ESTADOS.get(e["status"], e["status"]),
                                 e["totalLoans"], e["activeLoans"], e["totalReviews"]])
    for p in reporte["loans"]:
        hojas["Préstamos"].append([p["code"], p["name"], f"RES-{p['reservationId']:05d}", p["requester"], p["email"], p["teacher"], p["purpose"],
                                   fecha(p["reservedStart"]), fecha(p["reservedEnd"]), fecha(p["startedAt"]), fecha(p["returnedAt"]), p["state"]])
    for r in reporte["reviews"]:
        hojas["Revisiones"].append([r["code"], r["name"], r["reviewer"], fecha(r["reviewedAt"]), r["comments"]])

    libro = Workbook()
    libro.remove(libro.active)
    for nombre, filas in hojas.items():
        hoja = libro.create_sheet(nombre)
        for fila in filas:
            hoja.append(fila)
        hoja.freeze_panes = "A2"
        hoja.auto_filter.ref = hoja.dimensions
        for columna in range(1, len(filas[0]) + 1):
            hoja.column_dimensions[hoja.cell(1, columna).column_letter].width = 25
    salida = BytesIO()
    libro.save(salida)
    return salida.getvalue()
