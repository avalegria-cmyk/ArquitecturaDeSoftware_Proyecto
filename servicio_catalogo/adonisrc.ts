import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  commands: [() => import('@adonisjs/core/commands')],
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/hash_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl', 'test'],
    },
    () => import('@adonisjs/core/providers/vinejs_provider'),
  ],
  // mongo.ts abre la conexión a MongoDB antes de recibir peticiones.
  preloads: [
    { file: () => import('#start/mongo'), environment: ['web'] },
    () => import('#start/routes'),
    () => import('#start/kernel'),
  ],
  tests: {
    suites: [{ files: ['tests/unit/**/*.spec.{ts,js}'], name: 'unit', timeout: 2000 }],
    forceExit: false,
  },
  metaFiles: [],
})
