//! Validación de la foto de evidencia (misma regla que GdPhotoProcessor del monolito).
use base64::{Engine, engine::general_purpose::STANDARD};

use crate::error::{Resultado, invalido};

pub struct Foto {
    pub bytes: Vec<u8>,
    pub width: i32,
    pub height: i32,
}

pub fn decodificar(texto: &str) -> Resultado<Vec<u8>> {
    if texto.len() > 5_592_408 {
        return Err(invalido("La foto supera el tamaño permitido."));
    }
    STANDARD.decode(texto).map_err(|_| invalido("La foto recibida no es válida."))
}

pub fn preparar(bytes: Vec<u8>) -> Resultado<Foto> {
    if bytes.is_empty() || bytes.len() > 4 * 1024 * 1024 {
        return Err(invalido("La foto debe ocupar como máximo 4 MB después de comprimirla."));
    }
    match medidas_jpeg(&bytes) {
        Some((width, height)) if width.max(height) <= 2560 && width.min(height) >= 480 => Ok(Foto { bytes, width, height }),
        _ => Err(invalido("Envía una foto JPEG nítida, con lados de entre 480 y 2560 píxeles.")),
    }
}

/// Lee ancho y alto del marcador SOF del JPEG.
pub fn medidas_jpeg(b: &[u8]) -> Option<(i32, i32)> {
    if b.len() < 4 || b[0] != 0xFF || b[1] != 0xD8 {
        return None;
    }
    let u16_en = |i: usize| -> Option<i32> { Some(i32::from(u16::from_be_bytes([*b.get(i)?, *b.get(i + 1)?]))) };
    let mut i = 2;
    while i + 9 < b.len() {
        if b[i] != 0xFF {
            return None;
        }
        let marcador = b[i + 1];
        if marcador == 0xFF {
            i += 1;
            continue;
        }
        if marcador == 0x01 || (0xD0..=0xD7).contains(&marcador) {
            i += 2;
            continue;
        }
        if marcador == 0xD9 || marcador == 0xDA {
            return None;
        }
        let largo = u16_en(i + 2)? as usize;
        if (0xC0..=0xCF).contains(&marcador) && ![0xC4, 0xC8, 0xCC].contains(&marcador) {
            return Some((u16_en(i + 7)?, u16_en(i + 5)?));
        }
        i += 2 + largo;
    }
    None
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn lee_medidas_de_un_jpeg() {
        let jpeg = [0xFF, 0xD8, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x01, 0xE0, 0x02, 0x80, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        assert_eq!(medidas_jpeg(&jpeg), Some((640, 480)));
        assert_eq!(medidas_jpeg(b"no es jpeg"), None);
    }

    #[test]
    fn rechaza_base64_invalido() {
        assert!(decodificar("@@@").is_err());
    }
}
