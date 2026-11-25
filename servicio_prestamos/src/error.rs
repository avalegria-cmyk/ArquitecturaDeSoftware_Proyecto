//! Errores HTTP con la forma { "message": "..." } que espera el frontend.
use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;

#[derive(Debug)]
pub struct ApiError {
    pub status: StatusCode,
    pub message: String,
}

pub type Resultado<T> = Result<T, ApiError>;

fn error(status: StatusCode, mensaje: impl Into<String>) -> ApiError {
    ApiError { status, message: mensaje.into() }
}
pub fn invalido(m: impl Into<String>) -> ApiError {
    error(StatusCode::UNPROCESSABLE_ENTITY, m)
}
pub fn prohibido(m: impl Into<String>) -> ApiError {
    error(StatusCode::FORBIDDEN, m)
}
pub fn conflicto(m: impl Into<String>) -> ApiError {
    error(StatusCode::CONFLICT, m)
}
pub fn no_autorizado(m: impl Into<String>) -> ApiError {
    error(StatusCode::UNAUTHORIZED, m)
}
pub fn no_disponible(m: impl Into<String>) -> ApiError {
    error(StatusCode::SERVICE_UNAVAILABLE, m)
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(json!({ "message": self.message }))).into_response()
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(e: sqlx::Error) -> Self {
        if let sqlx::Error::Database(db) = &e {
            if db.code().as_deref() == Some("23505") {
                return conflicto("Otra solicitud se procesó al mismo tiempo. Actualiza la disponibilidad y vuelve a intentarlo.");
            }
        }
        tracing::error!("error de base de datos: {e}");
        error(StatusCode::INTERNAL_SERVER_ERROR, "No se pudo completar la solicitud. Revisa la conexión del servidor.")
    }
}
