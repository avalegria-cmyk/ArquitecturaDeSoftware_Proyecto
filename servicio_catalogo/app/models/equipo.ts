import mongoose, { Schema } from 'mongoose'

export const ESTADOS = ['disponible', 'prestado', 'mantenimiento', 'fuera_servicio', 'deshabilitado'] as const
export type Estado = (typeof ESTADOS)[number]

/**
 * Un documento por unidad física. El `id` numérico se conserva del monolito
 * porque los otros servicios (Reservas, Préstamos...) guardan ese número.
 */
const equipoSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    status: { type: String, enum: ESTADOS, default: 'disponible' },
    location: { type: String, required: true },
    description: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: 'equipment', versionKey: false }
)

export interface EquipoDoc {
  id: number
  code: string
  name: string
  category: string
  status: Estado
  location: string
  description: string
}

export const Equipo = mongoose.model('Equipo', equipoSchema)

export const publico = (e: EquipoDoc) => ({
  id: e.id,
  code: e.code,
  name: e.name,
  category: e.category,
  status: e.status,
  location: e.location,
  description: e.description,
})
