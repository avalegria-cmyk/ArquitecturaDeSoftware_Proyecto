//! Servicio de Préstamos de UniEquipos (Rust + Axum + PostgreSQL prestamos_db).
mod auth;
mod clientes;
mod db;
mod error;
mod eventos;
mod foto;
mod politica;
mod rutas;

use std::{sync::Arc, time::Duration};

use axum::{
    Router,
    extract::DefaultBodyLimit,
    middleware,
    routing::{get, post},
};
use sqlx::{PgPool, postgres::PgPoolOptions};

pub struct Estado {
    pub pool: PgPool,
    pub clientes: clientes::Clientes,
    pub eventos: eventos::Eventos,
    pub token: String,
}

async fn conectar(url: &str) -> PgPool {
    for intento in 1..=30 {
        match PgPoolOptions::new().max_connections(10).acquire_timeout(Duration::from_secs(5)).connect(url).await {
            Ok(pool) => match sqlx::raw_sql(db::ESQUEMA).execute(&pool).await {
                Ok(_) => {
                    tracing::info!("Esquema de prestamos_db listo");
                    return pool;
                }
                Err(e) => tracing::warn!("No se pudo crear el esquema: {e}"),
            },
            Err(_) => tracing::warn!("Esperando a PostgreSQL... ({intento})"),
        }
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
    panic!("No se pudo conectar a PostgreSQL");
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_target(false).init();
    let token = std::env::var("INTERNAL_TOKEN").expect("Configura INTERNAL_TOKEN");
    let pool = conectar(&std::env::var("DATABASE_URL").expect("Configura DATABASE_URL")).await;
    let estado = Arc::new(Estado { pool, clientes: clientes::Clientes::desde_entorno(token.clone()), eventos: eventos::Eventos::desde_entorno(), token });

    let app = Router::new()
        .route("/api/loans", get(rutas::listar))
        .route("/api/loans/start", post(rutas::iniciar))
        .route("/api/loans/return", post(rutas::devolver))
        .route("/api/loans/{reserva}/photos/{fase}", get(rutas::foto))
        .route("/internal/loans", get(rutas::lista_interna))
        .route("/internal/loans/latest", get(rutas::ultimos))
        .layer(middleware::from_fn_with_state(estado.clone(), auth::solo_interno))
        .route("/health", get(rutas::salud))
        .layer(DefaultBodyLimit::max(8 * 1024 * 1024))
        .with_state(estado);

    let puerto = std::env::var("PORT").unwrap_or_else(|_| "3004".into());
    let oyente = tokio::net::TcpListener::bind(format!("0.0.0.0:{puerto}")).await.expect("puerto libre");
    tracing::info!("Servicio de préstamos escuchando en :{puerto}");
    axum::serve(oyente, app)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await
        .expect("servidor");
}
