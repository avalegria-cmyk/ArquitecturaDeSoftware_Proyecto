//! Rutas HTTP del servicio de Préstamos.
use std::{collections::HashMap, sync::Arc};

use axum::{
    Json,
    extract::{Path, Query, State},
    http::header,
    response::IntoResponse,
};
use chrono::{DateTime, SecondsFormat, Utc};
use serde_json::{Value, json};

use crate::{
    Estado,
    auth::Usuario,
    db::{self, NuevoPrestamo, Prestamo},
    error::{Resultado, conflicto, invalido, prohibido},
    foto, politica,
};

fn iso(fecha: DateTime<Utc>) -> String {
    fecha.to_rfc3339_opts(SecondsFormat::Secs, true)
}

fn fecha(texto: &str) -> Resultado<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(texto).map(|f| f.with_timezone(&Utc)).map_err(|_| invalido("Fecha de reserva no válida."))
}

/// Datos del préstamo tal como los muestra el frontend.
fn prestamo_json(p: &Prestamo) -> Value {
    json!({
        "id": p.id,
        "startedAt": iso(p.started_at),
        "returnedAt": p.returned_at.map(iso),
        "startPhotoUrl": format!("/api/loans/{}/photos/inicio", p.reservation_id),
        "returnPhotoUrl": p.returned_at.map(|_| format!("/api/loans/{}/photos/devolucion", p.reservation_id)),
    })
}

pub async fn salud() -> Json<Value> {
    Json(json!({ "status": "ok", "service": "prestamos" }))
}

/// GET /api/loans: reservas aprobadas (de Reservas) + datos del préstamo (de esta base).
pub async fn listar(State(estado): State<Arc<Estado>>, usuario: Usuario) -> Resultado<Json<Value>> {
    let solicitante = (!usuario.gestiona_equipos()).then_some(usuario.id);
    let mut reservas = estado.clientes.reservas_aceptadas(solicitante).await?;
    let ids: Vec<i64> = reservas.iter().filter_map(|r| r["id"].as_i64()).collect();
    let prestamos: HashMap<i64, Prestamo> = db::por_reservas(&estado.pool, &ids).await?.into_iter().map(|p| (p.reservation_id, p)).collect();
    for reserva in &mut reservas {
        if let Some(p) = reserva["id"].as_i64().and_then(|id| prestamos.get(&id)) {
            reserva["loan"] = prestamo_json(p);
        }
    }
    Ok(Json(json!({ "reservations": reservas, "serverNow": iso(Utc::now()) })))
}

pub async fn iniciar(State(estado): State<Arc<Estado>>, usuario: Usuario, Json(datos): Json<Value>) -> Resultado<Json<Value>> {
    registrar(estado, usuario, datos, "inicio").await
}

pub async fn devolver(State(estado): State<Arc<Estado>>, usuario: Usuario, Json(datos): Json<Value>) -> Resultado<Json<Value>> {
    registrar(estado, usuario, datos, "devolucion").await
}

/// Inicio o devolución con foto. Es una saga: primero se guarda en esta base,
/// luego se cambia el estado en Catálogo y, si algo falla, se compensa.
async fn registrar(estado: Arc<Estado>, usuario: Usuario, datos: Value, fase: &str) -> Resultado<Json<Value>> {
    if datos["completeDeviceConfirmed"] != Value::Bool(true) {
        return Err(invalido("Confirma que se ve el equipo completo y su código en la foto."));
    }
    let texto = datos["photo"].as_str().ok_or_else(|| invalido("El campo photo es obligatorio y debe ser texto."))?;
    let bytes = foto::decodificar(texto.trim())?;
    let reserva_id = datos["reservationId"].as_i64().filter(|id| *id > 0).ok_or_else(|| invalido("Selecciona un valor válido para reservationId."))?;
    let evidencia = foto::preparar(bytes)?;
    let reserva = estado.clientes.reserva(reserva_id).await?.ok_or_else(|| conflicto("La reserva ya no está disponible."))?;
    politica::verificar_dueno(&usuario, reserva.requester.id)?;
    let prueba_admin = politica::es_prueba_admin(&usuario);
    let ahora = Utc::now();

    let mut tx = estado.pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock($1)").bind(reserva_id).execute(&mut *tx).await?;
    let actual = db::por_reserva(&mut tx, reserva_id).await?;
    let equipo = reserva.equipment.id;

    let (prestamo_id, devuelto) = if fase == "inicio" {
        // Reintentos tras perder la respuesta conservan el préstamo y su evidencia inicial.
        if actual.as_ref().is_some_and(|p| p.returned_at.is_none()) {
            return Ok(Json(json!({ "loan": { "reservationId": reserva_id, "state": "en_uso" } })));
        }
        let datos_inicio = politica::DatosInicio {
            estado: &reserva.status,
            tiene_prestamo: actual.is_some(),
            inicio: fecha(&reserva.starts_at)?,
            fin: fecha(&reserva.ends_at)?,
            estado_equipo: reserva.equipment_status.as_deref(),
        };
        if let Some(problema) = politica::problema_inicio(&datos_inicio, ahora, prueba_admin) {
            return Err(conflicto(problema));
        }
        let nuevo = NuevoPrestamo { reserva: reserva_id, equipo, solicitante: reserva.requester.id, nombre: &reserva.requester.name, docente: reserva.teacher.id };
        let id = db::crear(&mut tx, nuevo, ahora).await?;
        db::guardar_foto(&mut tx, id, "inicio", &evidencia, ahora).await?;
        // Paso 2 de la saga: Catálogo marca la unidad como prestada (si falla, la transacción no se confirma).
        estado.clientes.catalogo(equipo, "loaned").await?;
        if let Err(error) = tx.commit().await {
            // Compensación: la unidad vuelve a estar disponible.
            let _ = estado.clientes.catalogo(equipo, "release").await;
            return Err(error.into());
        }
        (id, None)
    } else {
        let prestamo = actual.ok_or_else(|| conflicto("Primero debes registrar el inicio de uso."))?;
        if prestamo.returned_at.is_some() {
            return Ok(Json(json!({ "loan": { "reservationId": reserva_id, "state": "devuelto" } })));
        }
        // No exige esperar al fin; tampoco impide devolver después de la hora prevista.
        db::guardar_foto(&mut tx, prestamo.id, "devolucion", &evidencia, ahora).await?;
        db::marcar_devuelto(&mut tx, prestamo.id, ahora).await?;
        estado.clientes.catalogo(equipo, "returned").await?;
        tx.commit().await?;
        (prestamo.id, Some(ahora))
    };

    // Después de confirmar: copia en Reservas (REST) y evento en RabbitMQ (bitácora y aviso a los navegadores).
    let accion = format!(
        "{}{}:{prestamo_id}",
        if prueba_admin { "loan.admin_test." } else { "loan." },
        if devuelto.is_some() { "returned" } else { "started" }
    );
    let copia = json!({ "loanId": prestamo_id, "startedAt": iso(ahora), "returnedAt": devuelto.map(iso) });
    let copia = if devuelto.is_some() {
        let inicio = db::por_reservas(&estado.pool, &[reserva_id]).await?.first().map(|p| iso(p.started_at));
        json!({ "loanId": prestamo_id, "startedAt": inicio, "returnedAt": devuelto.map(iso) })
    } else {
        copia
    };
    let fondo = estado.clone();
    tokio::spawn(async move {
        fondo.clientes.informar_reserva(reserva_id, copia).await;
        fondo.eventos.publicar(accion, Some(usuario.id)).await;
    });
    let estado_final = if devuelto.is_some() { "devuelto" } else { "en_uso" };
    Ok(Json(json!({ "loan": { "reservationId": reserva_id, "state": estado_final } })))
}

/// GET /api/loans/{reserva}/photos/{fase}
pub async fn foto(State(estado): State<Arc<Estado>>, usuario: Usuario, Path((reserva, fase)): Path<(i64, String)>) -> Resultado<impl IntoResponse> {
    if reserva < 1 || !matches!(fase.as_str(), "inicio" | "devolucion") {
        return Err(prohibido("No tienes acceso a esta evidencia."));
    }
    let registro = db::evidencia(&estado.pool, reserva, &fase).await?;
    let registro = registro
        .filter(|r| politica::puede_ver_evidencia(&usuario, r.requester_id, r.teacher_id))
        .ok_or_else(|| prohibido("No tienes acceso a esta evidencia."))?;
    let nombre = format!("inline; filename=\"equipo-{reserva}-{fase}.jpg\"");
    Ok((
        [
            (header::CONTENT_TYPE, "image/jpeg".to_string()),
            (header::CACHE_CONTROL, "private, no-store".to_string()),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff".to_string()),
            (header::CONTENT_DISPOSITION, nombre),
        ],
        registro.content,
    ))
}

fn prestamo_interno(p: &Prestamo) -> Value {
    json!({
        "id": p.id, "reservationId": p.reservation_id, "equipmentId": p.equipment_id,
        "requesterId": p.requester_id, "requesterName": p.requester_name, "teacherId": p.teacher_id,
        "startedAt": iso(p.started_at), "returnedAt": p.returned_at.map(iso), "active": p.returned_at.is_none(),
    })
}

/// GET /internal/loans?equipmentId=1 (Reportes)
pub async fn lista_interna(State(estado): State<Arc<Estado>>, Query(q): Query<HashMap<String, String>>) -> Resultado<Json<Value>> {
    let equipo = q.get("equipmentId").and_then(|v| v.parse().ok());
    let prestamos = db::todos(&estado.pool, equipo).await?;
    Ok(Json(json!({ "loans": prestamos.iter().map(prestamo_interno).collect::<Vec<_>>() })))
}

/// GET /internal/loans/latest?equipmentIds=1,2 (Mantenimiento)
pub async fn ultimos(State(estado): State<Arc<Estado>>, Query(q): Query<HashMap<String, String>>) -> Resultado<Json<Value>> {
    let ids: Vec<i64> = q.get("equipmentIds").map(|v| v.split(',').filter_map(|n| n.parse().ok()).collect()).unwrap_or_default();
    let prestamos = db::ultimos(&estado.pool, &ids).await?;
    Ok(Json(json!({ "loans": prestamos.iter().map(prestamo_interno).collect::<Vec<_>>() })))
}
