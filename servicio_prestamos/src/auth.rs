//! Seguridad: token interno y usuario que el API Gateway ya validó con Identidad.
use std::sync::Arc;

use axum::{
    extract::{FromRequestParts, Request, State},
    http::request::Parts,
    middleware::Next,
    response::{IntoResponse, Response},
};

use crate::{
    Estado,
    error::{ApiError, no_autorizado, prohibido},
};

#[derive(Debug, Clone)]
pub struct Usuario {
    pub id: i64,
    pub role: String,
}

impl Usuario {
    pub fn gestiona_equipos(&self) -> bool {
        self.role == "administrador" || self.role == "encargado"
    }
}

impl<S: Send + Sync> FromRequestParts<S> for Usuario {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, Self::Rejection> {
        let cabecera = |nombre: &str| parts.headers.get(nombre).and_then(|v| v.to_str().ok()).unwrap_or("");
        let id: i64 = cabecera("x-user-id").parse().unwrap_or(0);
        let role = cabecera("x-user-role").to_string();
        if id < 1 || role.is_empty() {
            return Err(no_autorizado("La sesión terminó. Inicia sesión nuevamente."));
        }
        Ok(Usuario { id, role })
    }
}

/// Compara sin cortar en el primer byte distinto (evita ataques de tiempo).
fn iguales(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

/// Solo el API Gateway y los otros microservicios conocen el token interno.
pub async fn solo_interno(State(estado): State<Arc<Estado>>, req: Request, next: Next) -> Response {
    let recibido = req.headers().get("x-internal-token").map(|v| v.as_bytes()).unwrap_or(b"");
    if estado.token.is_empty() || !iguales(recibido, estado.token.as_bytes()) {
        return prohibido("Acceso interno no autorizado.").into_response();
    }
    next.run(req).await
}
