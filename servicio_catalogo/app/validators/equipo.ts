import vine, { SimpleMessagesProvider } from '@vinejs/vine'

const LIMITES = 'Completa los campos del equipo y respeta sus límites de longitud.'
const texto = (maximo: number) => vine.string().trim().minLength(1).maxLength(maximo)
const fotos = vine.array(vine.string()).maxLength(5).optional()

const mensajes = new SimpleMessagesProvider({
  'required': LIMITES,
  'string': LIMITES,
  'minLength': LIMITES,
  'maxLength': LIMITES,
  'enum': 'Selecciona un estado válido.',
  'number': 'Selecciona un valor válido para id.',
  'photos.array': 'Selecciona hasta 5 imágenes.',
  'photos.maxLength': 'Selecciona hasta 5 imágenes.',
  'photos.*.string': 'La imagen no es válida o supera el límite.',
  'removeImageIds.array': 'Imágenes a retirar no válidas.',
  'removeImageIds.maxLength': 'Imágenes a retirar no válidas.',
  'removeImageIds.*.number': 'Imagen no válida.',
  'removeImageIds.*.min': 'Imagen no válida.',
})

/** Alta: el código se genera solo; un préstamo se registra desde su propio servicio. */
export const validarAlta = vine.create({
  name: texto(120),
  category: texto(60),
  status: vine.enum(['disponible', 'mantenimiento', 'fuera_servicio']),
  location: texto(120),
  description: texto(2000),
  photos: fotos,
})
validarAlta.messagesProvider = mensajes

export const validarEdicion = vine.create({
  id: vine.number().withoutDecimals().min(1),
  name: texto(120),
  category: texto(60),
  status: vine.enum(['disponible', 'mantenimiento', 'fuera_servicio', 'prestado', 'deshabilitado']),
  location: texto(120),
  description: texto(2000),
  photos: fotos,
  removeImageIds: vine.array(vine.number().withoutDecimals().min(1)).maxLength(5).optional(),
})
validarEdicion.messagesProvider = mensajes

export const validarId = vine.create({ id: vine.number().withoutDecimals().min(1) })
validarId.messagesProvider = mensajes
