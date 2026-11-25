//! Comunicación REST (síncrona) con Reservas y Catálogo.
use std::time::Duration;

use reqwest::{Client, StatusCode};
use serde::Deserialize;
use serde_json::Value;

use crate::error::{Resultado, conflicto, no_disponible};

#[derive(Debug, Deserialize)]
pub struct Persona {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct EquipoRef {
    pub id: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Reserva {
    pub id: i64,
    pub status: String,
    pub requester: Persona,
    pub teacher: Persona,
    pub equipment: EquipoRef,
    pub starts_at: String,
    pub ends_at: String,
    pub equipment_status: Option<String>,
}

pub struct Clientes {
    http: Client,
    token: String,
    reservas: String,
    catalogo: String,
}

impl Clientes {
    pub fn desde_entorno(token: String) -> Self {
        Clientes {
            http: Client::builder().timeout(Duration::from_secs(4)).build().expect("cliente HTTP"),
            token,
            reservas: std::env::var("RESERVAS_URL").unwrap_or_else(|_| "http://reservas:3003".into()),
            catalogo: std::env::var("CATALOGO_URL").unwrap_or_else(|_| "http://catalogo:3002".into()),
        }
    }

    fn get(&self, url: String) -> reqwest::RequestBuilder {
        self.http.get(url).header("X-Internal-Token", &self.token).header("X-Service", "prestamos")
    }

    fn post(&self, url: String) -> reqwest::RequestBuilder {
        self.http.post(url).header("X-Internal-Token", &self.token).header("X-Service", "prestamos")
    }

    /// GET /internal/reservations/{id} en Reservas.
    pub async fn reserva(&self, id: i64) -> Resultado<Option<Reserva>> {
        let r = self.get(format!("{}/internal/reservations/{id}", self.reservas)).send().await.map_err(|_| caido("reservas"))?;
        if r.status() == StatusCode::NOT_FOUND {
            return Ok(None);
        }
        let cuerpo: Value = r.error_for_status().map_err(|_| caido("reservas"))?.json().await.map_err(|_| caido("reservas"))?;
        Ok(serde_json::from_value(cuerpo["reservation"].clone()).ok())
    }

    /// Reservas aceptadas (todas o de un solicitante), con su línea de tiempo.
    pub async fn reservas_aceptadas(&self, solicitante: Option<i64>) -> Resultado<Vec<Value>> {
        let mut url = format!("{}/internal/reservations?status=aceptado", self.reservas);
        if let Some(id) = solicitante {
            url.push_str(&format!("&requesterId={id}"));
        }
        let r = self.get(url).send().await.and_then(|r| r.error_for_status()).map_err(|_| caido("reservas"))?;
        let cuerpo: Value = r.json().await.map_err(|_| caido("reservas"))?;
        Ok(cuerpo["reservations"].as_array().cloned().unwrap_or_default())
    }

    /// Cambio de estado atómico en Catálogo: loaned, release o returned.
    pub async fn catalogo(&self, equipo: i64, accion: &str) -> Resultado<()> {
        let r = self.post(format!("{}/internal/equipment/{equipo}/{accion}", self.catalogo)).send().await.map_err(|_| caido("catálogo"))?;
        if r.status() == StatusCode::CONFLICT {
            let cuerpo: Value = r.json().await.unwrap_or_default();
            return Err(conflicto(cuerpo["message"].as_str().unwrap_or("La unidad cambió de estado.")));
        }
        r.error_for_status().map(|_| ()).map_err(|_| caido("catálogo"))
    }

    /// Copia del préstamo en Reservas (consistencia eventual: se reintenta en segundo plano).
    pub async fn informar_reserva(&self, reserva: i64, prestamo: Value) {
        for intento in 1..=5 {
            let envio = self.post(format!("{}/internal/reservations/{reserva}/loan", self.reservas)).json(&prestamo).send().await;
            if matches!(&envio, Ok(r) if r.status().is_success()) {
                return;
            }
            tracing::warn!("Reservas no recibió el préstamo de la reserva {reserva} (intento {intento})");
            tokio::time::sleep(Duration::from_secs(2 * intento)).await;
        }
    }
}

fn caido(servicio: &str) -> crate::error::ApiError {
    no_disponible(format!("El servicio de {servicio} no está disponible. Intenta nuevamente en unos segundos."))
}
