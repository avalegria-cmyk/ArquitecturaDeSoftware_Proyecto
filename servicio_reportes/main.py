from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from config.database import crear_tablas
from router.interno_router import router as interno_router
from router.reporte_router import router as reporte_router


@asynccontextmanager
async def ciclo_de_vida(_: FastAPI):
    crear_tablas()
    yield


app = FastAPI(title="Servicio Reportes", version="1.0.0",
              description="Microservicio de reportes y bitácora de UniEquipos (FastAPI + MySQL)", lifespan=ciclo_de_vida)


# Todas las respuestas de error tienen la forma { message } que espera el frontend.
@app.exception_handler(HTTPException)
async def error_http(_: Request, error: HTTPException):
    mensaje = error.detail if isinstance(error.detail, str) else "Solicitud no válida."
    return JSONResponse({"message": "Ruta no encontrada." if error.status_code == 404 and mensaje == "Not Found" else mensaje}, error.status_code)


@app.exception_handler(RequestValidationError)
async def error_validacion(_: Request, error: RequestValidationError):
    return JSONResponse({"message": "Datos no válidos."}, 422)


app.include_router(reporte_router)
app.include_router(interno_router)


@app.get("/health")
def salud():
    return {"status": "ok", "service": "reportes"}
