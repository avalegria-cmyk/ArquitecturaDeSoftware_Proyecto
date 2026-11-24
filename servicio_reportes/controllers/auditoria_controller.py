from sqlalchemy.orm import Session

from models.auditoria import Auditoria
from schemas.auditoria import AuditoriaCreate


def registrar(db: Session, datos: AuditoriaCreate, servicio: str | None) -> Auditoria:
    registro = Auditoria(user_id=datos.userId, action=datos.action, service=servicio)
    db.add(registro)
    db.commit()
    db.refresh(registro)
    return registro


def ultimas(db: Session, limite: int) -> list[Auditoria]:
    return db.query(Auditoria).order_by(Auditoria.id.desc()).limit(limite).all()
