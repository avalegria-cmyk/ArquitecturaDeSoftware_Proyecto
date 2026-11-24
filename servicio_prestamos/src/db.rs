//! Acceso a prestamos_db (PostgreSQL) con SQLx.
use chrono::{DateTime, Utc};
use sqlx::{FromRow, PgConnection, PgPool};

use crate::foto::Foto;

pub const ESQUEMA: &str = r#"
-- Base privada del servicio de Préstamos (prestamos_db).
CREATE TABLE IF NOT EXISTS loans (
  id BIGSERIAL PRIMARY KEY,
  reservation_id BIGINT NOT NULL UNIQUE,
  equipment_id BIGINT NOT NULL,
  -- Copias para no consultar a Reservas en cada foto o reporte.
  requester_id BIGINT NOT NULL,
  requester_name VARCHAR(120) NOT NULL,
  teacher_id BIGINT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  returned_at TIMESTAMPTZ
);
-- Un equipo solo puede tener un préstamo activo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_equipment ON loans (equipment_id) WHERE returned_at IS NULL;
CREATE TABLE IF NOT EXISTS loan_photos (
  id BIGSERIAL PRIMARY KEY,
  loan_id BIGINT NOT NULL REFERENCES loans (id),
  phase VARCHAR(12) NOT NULL CHECK (phase IN ('inicio', 'devolucion')),
  content BYTEA NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  byte_size INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_loan_photo_phase UNIQUE (loan_id, phase)
);
"#;

#[derive(Debug, FromRow)]
pub struct Prestamo {
    pub id: i64,
    pub reservation_id: i64,
    pub equipment_id: i64,
    pub requester_id: i64,
    pub requester_name: String,
    pub teacher_id: i64,
    pub started_at: DateTime<Utc>,
    pub returned_at: Option<DateTime<Utc>>,
}

pub async fn por_reserva(cx: &mut PgConnection, reserva: i64) -> sqlx::Result<Option<Prestamo>> {
    sqlx::query_as("SELECT * FROM loans WHERE reservation_id = $1 FOR UPDATE").bind(reserva).fetch_optional(cx).await
}

pub struct NuevoPrestamo<'a> {
    pub reserva: i64,
    pub equipo: i64,
    pub solicitante: i64,
    pub nombre: &'a str,
    pub docente: i64,
}

pub async fn crear(cx: &mut PgConnection, p: NuevoPrestamo<'_>, ahora: DateTime<Utc>) -> sqlx::Result<i64> {
    sqlx::query_scalar(
        "INSERT INTO loans (reservation_id, equipment_id, requester_id, requester_name, teacher_id, started_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    )
    .bind(p.reserva)
    .bind(p.equipo)
    .bind(p.solicitante)
    .bind(p.nombre)
    .bind(p.docente)
    .bind(ahora)
    .fetch_one(cx)
    .await
}

pub async fn guardar_foto(cx: &mut PgConnection, prestamo: i64, fase: &str, foto: &Foto, ahora: DateTime<Utc>) -> sqlx::Result<()> {
    sqlx::query("INSERT INTO loan_photos (loan_id, phase, content, width, height, byte_size, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)")
        .bind(prestamo)
        .bind(fase)
        .bind(&foto.bytes)
        .bind(foto.width)
        .bind(foto.height)
        .bind(foto.bytes.len() as i32)
        .bind(ahora)
        .execute(cx)
        .await
        .map(|_| ())
}

pub async fn marcar_devuelto(cx: &mut PgConnection, prestamo: i64, ahora: DateTime<Utc>) -> sqlx::Result<()> {
    sqlx::query("UPDATE loans SET returned_at = $1 WHERE id = $2").bind(ahora).bind(prestamo).execute(cx).await.map(|_| ())
}

pub async fn todos(pool: &PgPool, equipo: Option<i64>) -> sqlx::Result<Vec<Prestamo>> {
    sqlx::query_as("SELECT * FROM loans WHERE $1::bigint IS NULL OR equipment_id = $1 ORDER BY started_at DESC, id DESC")
        .bind(equipo)
        .fetch_all(pool)
        .await
}

pub async fn por_reservas(pool: &PgPool, reservas: &[i64]) -> sqlx::Result<Vec<Prestamo>> {
    sqlx::query_as("SELECT * FROM loans WHERE reservation_id = ANY($1)").bind(reservas).fetch_all(pool).await
}

/// Último préstamo de cada equipo (lo usa Mantenimiento).
pub async fn ultimos(pool: &PgPool, equipos: &[i64]) -> sqlx::Result<Vec<Prestamo>> {
    sqlx::query_as("SELECT DISTINCT ON (equipment_id) * FROM loans WHERE equipment_id = ANY($1) ORDER BY equipment_id, id DESC")
        .bind(equipos)
        .fetch_all(pool)
        .await
}

#[derive(FromRow)]
pub struct Evidencia {
    pub content: Vec<u8>,
    pub requester_id: i64,
    pub teacher_id: i64,
}

pub async fn evidencia(pool: &PgPool, reserva: i64, fase: &str) -> sqlx::Result<Option<Evidencia>> {
    sqlx::query_as(
        "SELECT p.content, l.requester_id, l.teacher_id FROM loan_photos p JOIN loans l ON l.id = p.loan_id
         WHERE l.reservation_id = $1 AND p.phase = $2",
    )
    .bind(reserva)
    .bind(fase)
    .fetch_optional(pool)
    .await
}
