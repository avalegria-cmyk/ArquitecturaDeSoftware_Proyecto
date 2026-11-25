//! Comunicación asíncrona: publica cada acción como evento en RabbitMQ
//! (exchange topic `uniequipos.eventos`). Reportes la guarda en la bitácora
//! y Notificaciones avisa a los navegadores. No se espera respuesta de nadie.
use chrono::{SecondsFormat, Utc};
use lapin::{
    BasicProperties, Channel, Connection, ConnectionProperties, ExchangeKind,
    options::{BasicPublishOptions, ExchangeDeclareOptions},
    types::FieldTable,
};
use serde_json::json;
use tokio::sync::Mutex;

const EXCHANGE: &str = "uniequipos.eventos";

pub struct Eventos {
    url: Option<String>,
    // Se guarda la conexión junto al canal para que no se cierre.
    abierto: Mutex<Option<(Connection, Channel)>>,
}

impl Eventos {
    pub fn desde_entorno() -> Self {
        Eventos { url: std::env::var("RABBITMQ_URL").ok().filter(|u| !u.is_empty()), abierto: Mutex::new(None) }
    }

    async fn abrir(url: &str) -> lapin::Result<(Connection, Channel)> {
        let conexion = Connection::connect(url, ConnectionProperties::default()).await?;
        let canal = conexion.create_channel().await?;
        let opciones = ExchangeDeclareOptions { durable: true, ..Default::default() };
        canal.exchange_declare(EXCHANGE, ExchangeKind::Topic, opciones, FieldTable::default()).await?;
        Ok((conexion, canal))
    }

    /// Publica la acción (ej. `loan.started:3`). La clave de ruteo es la parte antes de ":".
    pub async fn publicar(&self, accion: String, usuario: Option<i64>) {
        let Some(url) = &self.url else { return };
        let evento = json!({
            "userId": usuario, "action": accion, "service": "prestamos",
            "at": Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true),
        });
        let cuerpo = serde_json::to_vec(&evento).unwrap_or_default();
        let clave = accion.split(':').next().unwrap_or_default().to_string();
        let mut abierto = self.abierto.lock().await;
        // Si la conexión se perdió, se reintenta una vez con una nueva.
        for _ in 0..2 {
            if abierto.as_ref().is_none_or(|(c, _)| !c.status().connected()) {
                *abierto = Self::abrir(url).await.map_err(|e| tracing::warn!("RabbitMQ no disponible: {e}")).ok();
            }
            if let Some((_, canal)) = abierto.as_ref() {
                let propiedades = BasicProperties::default()
                    .with_delivery_mode(2)
                    .with_content_type("application/json".into())
                    .with_app_id("prestamos".into());
                match canal.basic_publish(EXCHANGE, &clave, BasicPublishOptions::default(), &cuerpo, propiedades).await {
                    Ok(_) => return,
                    Err(e) => {
                        tracing::warn!("No se pudo publicar: {e}");
                        *abierto = None;
                    }
                }
            }
        }
        tracing::warn!("evento pendiente: {evento}");
    }
}
