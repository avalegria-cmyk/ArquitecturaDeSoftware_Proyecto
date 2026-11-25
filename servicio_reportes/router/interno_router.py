from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from config.database import obtener_db
from controllers import auditoria_controller
from schemas.auditoria import AuditoriaCreate, AuditoriaResponse
from seguridad import solo_interno

# Los demás microservicios envían aquí cada acción (bitácora central).
router = APIRouter(prefix="/internal/audit", tags=["auditoria"], dependencies=[Depends(solo_interno)])


@router.post("", status_code=201, response_model=AuditoriaResponse)
def registrar(datos: AuditoriaCreate, db: Session = Depends(obtener_db), x_service: str | None = Header(default=None)):
    return auditoria_controller.registrar(db, datos, x_service)


@router.get("", response_model=list[AuditoriaResponse])
def ultimas(limite: int = 50, db: Session = Depends(obtener_db)):
    return auditoria_controller.ultimas(db, min(max(limite, 1), 500))
