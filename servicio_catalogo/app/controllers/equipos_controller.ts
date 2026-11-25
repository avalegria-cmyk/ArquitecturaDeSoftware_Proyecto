import type { HttpContext } from '@adonisjs/core/http'
import { Equipo, publico, type EquipoDoc, type Estado } from '#models/equipo'
import { Imagen } from '#models/imagen'
import { siguiente } from '#models/contador'
import { conflicto, invalido, prohibido } from '#exceptions/errores'
import { puedeGestionarEquipos, type Usuario } from '#middleware/usuario_middleware'
import { siguienteCodigo } from '#services/codigo_equipo'
import { decodificar, prepararFoto } from '#services/foto'
import { estadoDeshabilitado, siguienteEstado } from '#services/estado_equipo'
import { publicar } from '#services/eventos'
import { validarAlta, validarEdicion, validarId } from '#validators/equipo'

const imagenUrl = (id: number) => ({ id, url: `/api/equipment/images/${id}` })

function autorizar(usuario: Usuario, mensaje: string) {
  if (!puedeGestionarEquipos(usuario)) throw prohibido(mensaje)
}

function fotos(base64: string[] | undefined) {
  return (base64 ?? []).map((foto) => prepararFoto(decodificar(foto, 'La imagen no es válida o supera el límite.')))
}

async function guardarFotos(equipmentId: number, lista: { bytes: Buffer }[]) {
  for (const foto of lista) {
    await Imagen.create({ id: await siguiente('image'), equipmentId, content: foto.bytes })
  }
}

export default class EquiposController {
  /** GET /api/equipment: catálogo completo con las URL de sus imágenes. */
  async index() {
    const [equipos, imagenes] = await Promise.all([
      Equipo.find().sort({ code: 1 }).lean<EquipoDoc[]>(),
      Imagen.find({}, { id: 1, equipmentId: 1 }).sort({ id: 1 }).lean<{ id: number; equipmentId: number }[]>(),
    ])
    const porEquipo = new Map<number, ReturnType<typeof imagenUrl>[]>()
    for (const imagen of imagenes) {
      porEquipo.set(imagen.equipmentId, [...(porEquipo.get(imagen.equipmentId) ?? []), imagenUrl(imagen.id)])
    }
    return { equipment: equipos.map((e) => ({ ...publico(e), images: porEquipo.get(e.id) ?? [] })) }
  }

  /** POST /api/equipment: alta de una unidad con hasta 5 imágenes. */
  async store({ request, response, usuario }: HttpContext) {
    autorizar(usuario, 'Solo el administrador y el encargado pueden agregar equipos.')
    const datos = await request.validateUsing(validarAlta)
    const preparadas = fotos(datos.photos)
    const equipo = await Equipo.create({
      id: await siguiente('equipment'),
      code: await siguienteCodigo(datos.category),
      name: datos.name,
      category: datos.category,
      status: datos.status,
      location: datos.location,
      description: datos.description,
    })
    try {
      await guardarFotos(equipo.id, preparadas)
    } catch (error) {
      // Compensación: sin transacción en MongoDB standalone, se deshace el alta.
      await Imagen.deleteMany({ equipmentId: equipo.id })
      await Equipo.deleteOne({ id: equipo.id })
      throw error
    }
    publicar(`equipment.created:${equipo.id}`, usuario.id)
    return response.status(201).send({ equipment: { ...publico(equipo.toObject() as EquipoDoc), images: [] } })
  }

  /** POST /api/equipment/update: datos, estado e imágenes. */
  async update({ request, usuario }: HttpContext) {
    autorizar(usuario, 'Solo administrador y encargado pueden modificar o deshabilitar equipos.')
    const datos = await request.validateUsing(validarEdicion)
    const preparadas = fotos(datos.photos)
    const actual = await Equipo.findOne({ id: datos.id }).lean<EquipoDoc>()
    if (!actual) throw invalido('El equipo no existe.')
    const estado = siguienteEstado(actual.status, datos.status as Estado)
    const quitar = datos.removeImageIds ?? []
    const restantes = await Imagen.countDocuments({ equipmentId: actual.id, id: { $nin: quitar } })
    if (restantes + preparadas.length > 5) {
      throw invalido('Puedes guardar hasta 5 imágenes por equipo. Retira alguna imagen antes de agregar más.')
    }
    const mismaCategoria = actual.category.trim().toLocaleLowerCase('es') === datos.category.trim().toLocaleLowerCase('es')
    const code = mismaCategoria ? actual.code : await siguienteCodigo(datos.category)
    // Control de concurrencia optimista: solo se guarda si nadie cambió el estado entretanto.
    const cambio = await Equipo.updateOne(
      { id: actual.id, status: actual.status },
      { $set: { code, name: datos.name, category: datos.category, status: estado, location: datos.location, description: datos.description } }
    )
    if (cambio.matchedCount === 0) throw conflicto('La unidad cambió mientras la editabas. Actualiza el catálogo y vuelve a intentarlo.')
    if (quitar.length) await Imagen.deleteMany({ equipmentId: actual.id, id: { $in: quitar } })
    await guardarFotos(actual.id, preparadas)
    publicar(`equipment.updated:${actual.id}`, usuario.id)
    return { message: 'Equipo modificado.' }
  }

  /** POST /api/equipment/disable: baja lógica; el historial se conserva. */
  async disable({ request, usuario }: HttpContext) {
    autorizar(usuario, 'Solo administrador y encargado pueden modificar o deshabilitar equipos.')
    const { id } = await request.validateUsing(validarId)
    const actual = await Equipo.findOne({ id }).lean<EquipoDoc>()
    if (!actual) throw invalido('El equipo no existe.')
    const estado = estadoDeshabilitado(actual.status)
    if (estado !== actual.status) {
      const cambio = await Equipo.updateOne({ id, status: actual.status }, { $set: { status: estado } })
      if (cambio.matchedCount === 0) throw conflicto('La unidad cambió mientras la editabas. Actualiza el catálogo y vuelve a intentarlo.')
      publicar(`equipment.disabled:${id}`, usuario.id)
    }
    return { message: 'Equipo deshabilitado. Su historial se conserva.' }
  }

  /** GET /api/equipment/images/:id */
  async image({ params, response }: HttpContext) {
    const imagen = await Imagen.findOne({ id: Number(params.id) }).lean<{ content: { buffer: Uint8Array } | Buffer }>()
    if (!imagen) throw invalido('La imagen no existe.')
    const contenido = Buffer.isBuffer(imagen.content) ? imagen.content : Buffer.from(imagen.content.buffer)
    response.header('Content-Type', 'image/jpeg')
    response.header('Cache-Control', 'private, no-store')
    response.header('X-Content-Type-Options', 'nosniff')
    return response.send(contenido)
  }
}
