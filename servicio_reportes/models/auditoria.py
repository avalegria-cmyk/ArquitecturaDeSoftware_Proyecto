from sqlalchemy import BigInteger, Column, DateTime, Integer, String, func

from config.database import Base


class Auditoria(Base):
    """Bitácora de acciones (antes audit_logs del monolito). Todos los servicios escriben aquí por REST."""

    __tablename__ = "audit_logs"
    id = Column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, nullable=False, index=True)
    action = Column(String(100), nullable=False)
    service = Column(String(40), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
