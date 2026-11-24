import mongoose from 'mongoose'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'

/** Conecta con MongoDB reintentando mientras el contenedor de la base arranca. */
for (let intento = 1; ; intento++) {
  try {
    await mongoose.connect(env.get('MONGO_URL'), { serverSelectionTimeoutMS: 3000 })
    logger.info('Conectado a MongoDB (catalogo_db)')
    break
  } catch (error) {
    if (intento >= 30) throw error
    logger.warn('Esperando a MongoDB...')
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
}
