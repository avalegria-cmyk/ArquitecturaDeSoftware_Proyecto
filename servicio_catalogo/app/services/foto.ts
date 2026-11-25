import { invalido } from '#exceptions/errores'

const MAXIMO_BASE64 = 5592408

/** Decodifica base64 de forma estricta, igual que base64_decode($x, true) en PHP. */
export function decodificar(base64: unknown, mensaje: string): Buffer {
  if (typeof base64 !== 'string' || base64.length > MAXIMO_BASE64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw invalido(mensaje)
  }
  return Buffer.from(base64, 'base64')
}

/** Misma validación que GdPhotoProcessor: JPEG de hasta 4 MB con lados entre 480 y 2560 px. */
export function prepararFoto(bytes: Buffer) {
  if (bytes.length === 0 || bytes.length > 4 * 1024 * 1024) {
    throw invalido('La foto debe ocupar como máximo 4 MB después de comprimirla.')
  }
  const medidas = medidasJpeg(bytes)
  if (!medidas || Math.max(medidas.width, medidas.height) > 2560 || Math.min(medidas.width, medidas.height) < 480) {
    throw invalido('Envía una foto JPEG nítida, con lados de entre 480 y 2560 píxeles.')
  }
  return { bytes, ...medidas }
}

/** Lee ancho y alto del marcador SOF del JPEG sin decodificar la imagen completa. */
export function medidasJpeg(b: Buffer): { width: number; height: number } | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null
  let i = 2
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null
    const marcador = b[i + 1]
    if (marcador === 0xff) {
      i++
      continue
    }
    if (marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd7)) {
      i += 2
      continue
    }
    if (marcador === 0xd9 || marcador === 0xda) return null
    const largo = b.readUInt16BE(i + 2)
    const esSof = marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)
    if (esSof) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) }
    i += 2 + largo
  }
  return null
}
