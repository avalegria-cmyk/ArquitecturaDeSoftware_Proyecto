import mongoose, { Schema } from 'mongoose'

/**
 * Las imágenes van en su propia colección: un documento de MongoDB admite hasta 16 MB
 * y un equipo puede tener 5 imágenes de hasta 4 MB.
 */
const imagenSchema = new Schema(
  {
    id: { type: Number, required: true, unique: true },
    equipmentId: { type: Number, required: true, index: true },
    content: { type: Buffer, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: 'equipment_images', versionKey: false }
)

export const Imagen = mongoose.model('Imagen', imagenSchema)
