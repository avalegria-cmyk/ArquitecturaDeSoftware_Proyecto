//! Reglas de préstamo (Domain/Loans/LoanPolicy del monolito). Funciones puras.
use chrono::{DateTime, Utc};

use crate::{
    auth::Usuario,
    error::{Resultado, prohibido},
};

/// El administrador puede probar el flujo completo sin ser el solicitante ni esperar el horario.
pub fn es_prueba_admin(u: &Usuario) -> bool {
    u.role == "administrador"
}

pub fn verificar_dueno(u: &Usuario, solicitante: i64) -> Resultado<()> {
    if es_prueba_admin(u) {
        return Ok(());
    }
    if !matches!(u.role.as_str(), "estudiante" | "docente") || u.id != solicitante {
        return Err(prohibido("Solo quien solicitó el equipo puede iniciar su uso o devolverlo."));
    }
    Ok(())
}

pub struct DatosInicio<'a> {
    pub estado: &'a str,
    pub tiene_prestamo: bool,
    pub inicio: DateTime<Utc>,
    pub fin: DateTime<Utc>,
    pub estado_equipo: Option<&'a str>,
}

pub fn problema_inicio(d: &DatosInicio, ahora: DateTime<Utc>, prueba_admin: bool) -> Option<&'static str> {
    if d.estado != "aceptado" {
        return Some("Debes completar las tres aprobaciones antes de usar el equipo.");
    }
    if d.tiene_prestamo {
        return Some("Esta reserva ya tiene un préstamo registrado.");
    }
    if !prueba_admin && ahora < d.inicio {
        return Some("Todavía no llega la fecha y hora de inicio de tu reserva.");
    }
    if !prueba_admin && ahora >= d.fin {
        return Some("El período reservado ya terminó. Realiza una nueva reserva.");
    }
    if d.estado_equipo != Some("disponible") {
        return Some("Esta unidad todavía no está disponible. Puede seguir en uso o estar en mantenimiento.");
    }
    None
}

pub fn puede_ver_evidencia(u: &Usuario, solicitante: i64, docente: i64) -> bool {
    u.gestiona_equipos() || u.id == solicitante || (u.role == "docente" && u.id == docente)
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use chrono::Duration;

    fn usuario(id: i64, role: &str) -> Usuario {
        Usuario { id, role: role.into() }
    }

    #[test]
    fn solo_el_solicitante_o_el_admin_registran_el_uso() {
        assert!(verificar_dueno(&usuario(5, "estudiante"), 5).is_ok());
        assert!(verificar_dueno(&usuario(6, "estudiante"), 5).is_err());
        assert!(verificar_dueno(&usuario(2, "encargado"), 5).is_err());
        assert!(verificar_dueno(&usuario(1, "administrador"), 5).is_ok());
    }

    #[test]
    fn no_se_inicia_antes_de_la_hora() {
        let ahora = Utc::now();
        let datos = DatosInicio { estado: "aceptado", tiene_prestamo: false, inicio: ahora + Duration::hours(1), fin: ahora + Duration::hours(2), estado_equipo: Some("disponible") };
        assert!(problema_inicio(&datos, ahora, false).is_some());
        assert!(problema_inicio(&datos, ahora, true).is_none());
    }

    #[test]
    fn el_docente_responsable_ve_la_evidencia() {
        assert!(puede_ver_evidencia(&usuario(9, "docente"), 5, 9));
        assert!(!puede_ver_evidencia(&usuario(7, "estudiante"), 5, 9));
    }
}
