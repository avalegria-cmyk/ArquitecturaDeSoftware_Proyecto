import os
import time

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Base privada del servicio de Reportes: reportes_db en el MySQL de los microservicios.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./reportes.db")

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=1800)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def crear_tablas(intentos: int = 30):
    """Crea audit_logs al arrancar, esperando a que MySQL esté listo."""
    for intento in range(1, intentos + 1):
        try:
            Base.metadata.create_all(bind=engine)
            return
        except Exception:
            if intento == intentos:
                raise
            print("Esperando a MySQL...")
            time.sleep(2)


def obtener_db():
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        db.rollback()
        print(f"Ocurrió un error en la base de datos: {e}")
        raise
    finally:
        db.close()
