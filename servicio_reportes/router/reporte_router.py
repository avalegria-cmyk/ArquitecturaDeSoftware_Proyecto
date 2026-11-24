from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response

from controllers import reporte_controller
from seguridad import Usuario, solo_interno, usuario_actual
from services.excel import exportar

router = APIRouter(prefix="/api/reports", tags=["reportes"], dependencies=[Depends(solo_interno)])


def equipo_consultado(request: Request) -> int | None:
    valor = request.query_params.get("equipmentId")
    if valor is None:
        return None
    if not valor.isdigit() or int(valor) < 1:
        raise HTTPException(422, "Selecciona un equipo válido.")
    return int(valor)


def autorizar(usuario: Usuario):
    if not usuario.gestiona_equipos:
        raise HTTPException(403, "Solo administrador y encargado pueden consultar y exportar reportes.")


@router.get("")
async def reporte(usuario: Usuario = Depends(usuario_actual), equipo: int | None = Depends(equipo_consultado)):
    autorizar(usuario)
    return await reporte_controller.instantanea(equipo)


@router.get("/export")
async def exportar_excel(usuario: Usuario = Depends(usuario_actual), equipo: int | None = Depends(equipo_consultado)):
    autorizar(usuario)
    contenido = exportar(await reporte_controller.instantanea(equipo))
    nombre = f"UniEquipos-{'equipo-' + str(equipo) if equipo else 'general'}.xlsx"
    return Response(contenido, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="{nombre}"', "Cache-Control": "private, no-store"})
