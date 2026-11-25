from controllers.reporte_controller import componer, estado_prestamo
from services.excel import exportar, fecha

EQUIPOS = [{"id": 1, "code": "LAP-001", "name": "Laptop", "category": "Laptops", "status": "disponible", "location": "Lab", "description": "x"}]
PRESTAMOS = [{"id": 7, "equipmentId": 1, "reservationId": 3, "requesterName": "Ana", "startedAt": "2026-11-20T15:00:00Z", "returnedAt": None}]
RESERVAS = [{"id": 3, "requester": {"name": "Ana", "email": "ana@espe.edu.ec"}, "teacher": {"name": "Kevin"}, "purpose": "Clase",
             "startsAt": "2026-11-20T14:00:00Z", "endsAt": "2026-11-20T16:00:00Z", "equipment": {}}]


def test_compone_los_datos_de_los_servicios():
    reporte = componer(EQUIPOS, PRESTAMOS, [], RESERVAS, "2026-11-24T00:00:00Z")
    assert reporte["equipment"][0]["totalLoans"] == 1
    assert reporte["equipment"][0]["activeLoans"] == 1
    assert reporte["loans"][0]["teacher"] == "Kevin"
    assert reporte["loans"][0]["state"] == "En uso · atrasado"


def test_estado_devuelto():
    assert estado_prestamo({"returnedAt": "2026-11-20T16:00:00Z"}, None, "2026-11-24T00:00:00Z") == "Devuelto"


def test_fecha_en_hora_de_ecuador():
    assert fecha("2026-11-20T15:00:00Z") == "20/11/2026 10:00:00"


def test_excel_tiene_cuatro_hojas():
    from io import BytesIO
    from openpyxl import load_workbook
    libro = load_workbook(BytesIO(exportar(componer(EQUIPOS, PRESTAMOS, [], RESERVAS, "2026-11-24T00:00:00Z"))))
    assert libro.sheetnames == ["Equipos", "Préstamos", "Revisiones", "Información"]
    assert libro["Equipos"]["F2"].value == 1



def test_evento_de_rabbitmq_se_guarda_en_la_bitacora(monkeypatch, tmp_path):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from config.database import Base
    from models.auditoria import Auditoria
    import services.mensajeria as mensajeria
    motor = create_engine(f"sqlite:///{tmp_path}/prueba.db")
    Base.metadata.create_all(bind=motor)
    Sesion = sessionmaker(bind=motor)
    monkeypatch.setattr(mensajeria, "SessionLocal", Sesion)
    mensajeria.guardar({"userId": 5, "action": "loan.started:3", "service": "prestamos", "at": "2026-11-25T10:00:00Z"})
    with Sesion() as db:
        fila = db.query(Auditoria).one()
        assert (fila.user_id, fila.action, fila.service) == (5, "loan.started:3", "prestamos")
