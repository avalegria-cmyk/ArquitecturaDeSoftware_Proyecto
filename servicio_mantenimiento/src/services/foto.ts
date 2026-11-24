import { invalido } from "./errores";

/** Base64 estricto (como base64_decode($x, true) en PHP). */
export function decodificar(base64: string, mensaje: string): Uint8Array {
  if (base64.length > 5592408 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw invalido(mensaje);
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

/** JPEG de hasta 4 MB con lados entre 480 y 2560 px (regla del monolito). */
export function prepararFoto(bytes: Uint8Array): Uint8Array {
  if (bytes.length === 0 || bytes.length > 4 * 1024 * 1024) throw invalido("La foto debe ocupar como máximo 4 MB después de comprimirla.");
  const m = medidasJpeg(bytes);
  if (!m || Math.max(m.width, m.height) > 2560 || Math.min(m.width, m.height) < 480) {
    throw invalido("Envía una foto JPEG nítida, con lados de entre 480 y 2560 píxeles.");
  }
  return bytes;
}

export function medidasJpeg(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const u16 = (i: number) => (b[i]! << 8) | b[i + 1]!;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marcador = b[i + 1]!;
    if (marcador === 0xff) { i++; continue; }
    if (marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) { i += 2; continue; }
    if (marcador === 0xd9 || marcador === 0xda) return null;
    if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) return { height: u16(i + 5), width: u16(i + 7) };
    i += 2 + u16(i + 2);
  }
  return null;
}
