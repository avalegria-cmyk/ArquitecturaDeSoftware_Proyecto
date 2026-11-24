import { conflicto } from '#exceptions/errores'
import type { Estado } from '#models/equipo'

/**
 * Reglas de cambio de estado (las mismas del monolito, Domain/Equipment).
 * Un equipo "prestado" tiene un préstamo activo: lo marca el servicio de Préstamos.
 */
export function siguienteEstado(actual: Estado, solicitado: Estado): Estado {
  if (solicitado === actual) return actual
  if (actual === 'prestado') throw conflictoDominio('Primero registra la devolución del préstamo activo.')
  if (actual === 'mantenimiento')
    throw conflictoDominio('Habilita este equipo desde Mantenimiento, con foto y comentarios de revisión.')
  if (solicitado === 'prestado') throw conflictoDominio('El estado En préstamo se establece al iniciar el uso.')
  if (solicitado === 'deshabilitado') throw conflictoDominio('Usa Deshabilitar para dar de baja la unidad.')
  if (solicitado === 'disponible' && !['fuera_servicio', 'deshabilitado'].includes(actual))
    throw conflictoDominio('No se puede habilitar este equipo desde el catálogo.')
  if (actual === 'deshabilitado' && solicitado !== 'disponible')
    throw conflictoDominio('Primero habilita la unidad deshabilitada.')
  return solicitado
}

export function estadoDeshabilitado(actual: Estado): Estado {
  if (actual === 'prestado')
    throw conflictoDominio('Primero registra la devolución del préstamo activo antes de deshabilitar la unidad.')
  return 'deshabilitado'
}

/** Tras una devolución el equipo va a revisión, salvo que ya estuviera dado de baja. */
export function estadoTrasDevolucion(actual: Estado): Estado {
  return actual === 'fuera_servicio' || actual === 'deshabilitado' ? actual : 'mantenimiento'
}

// El monolito respondía 403 a las reglas de dominio (DomainException).
function conflictoDominio(mensaje: string) {
  const error = conflicto(mensaje)
  error.status = 403
  return error
}
