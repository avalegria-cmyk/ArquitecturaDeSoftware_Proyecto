import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  // Base privada del catálogo (MongoDB catalogo_db)
  MONGO_URL: Env.schema.string(),
  // Clave compartida con el gateway y los otros microservicios
  INTERNAL_TOKEN: Env.schema.secret(),
  // Broker de mensajes para publicar eventos (opcional en pruebas)
  RABBITMQ_URL: Env.schema.string.optional(),
})
