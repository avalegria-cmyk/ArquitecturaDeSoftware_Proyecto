import mongoose, { Schema } from 'mongoose'

/** Secuencias atómicas: ids numéricos y correlativos de código (LAP-001, CAM-002...). */
const contadorSchema = new Schema({ _id: String, seq: Number }, { collection: 'counters', versionKey: false })
const Contador = mongoose.model('Contador', contadorSchema)

export async function siguiente(nombre: string): Promise<number> {
  const contador = await Contador.findOneAndUpdate(
    { _id: nombre },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  )
  return contador!.seq as number
}
