"""Token interno y usuario que el API Gateway ya validó con Identidad."""
import hmac
import os
from dataclasses import dataclass
from urllib.parse import unquote

from fastapi import Header, HTTPException


def solo_interno(x_internal_token: str = Header(default="")):
    esperado = os.getenv("INTERNAL_TOKEN", "")
    if not esperado or not hmac.compare_digest(x_internal_token, esperado):
        raise HTTPException(403, "Acceso interno no autorizado.")


@dataclass
class Usuario:
    id: int
    role: str
    name: str

    @property
    def gestiona_equipos(self) -> bool:
        return self.role in ("administrador", "encargado")


def usuario_actual(x_user_id: str = Header(default=""), x_user_role: str = Header(default=""), x_user_name: str = Header(default="")) -> Usuario:
    if not x_user_id.isdigit() or int(x_user_id) < 1 or not x_user_role:
        raise HTTPException(401, "La sesión terminó. Inicia sesión nuevamente.")
    return Usuario(int(x_user_id), x_user_role, unquote(x_user_name))
