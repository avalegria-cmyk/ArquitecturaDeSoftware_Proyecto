import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const EquiposController = () => import('#controllers/equipos_controller')
const InternoController = () => import('#controllers/interno_controller')

router.get('/health', () => ({ status: 'ok', service: 'catalogo' }))

// Rutas públicas: llegan desde el navegador a través del API Gateway.
router
  .group(() => {
    router.get('/', [EquiposController, 'index'])
    router.post('/', [EquiposController, 'store'])
    router.post('/update', [EquiposController, 'update'])
    router.post('/disable', [EquiposController, 'disable'])
    router.get('/images/:id', [EquiposController, 'image']).where('id', /^[1-9][0-9]*$/)
  })
  .prefix('/api/equipment')
  .use([middleware.interno(), middleware.usuario()])

// Rutas internas: las usan Reservas, Préstamos, Mantenimiento y Reportes.
router
  .group(() => {
    router.get('/', [InternoController, 'index'])
    router.get('/:id', [InternoController, 'show'])
    router.post('/:id/loaned', [InternoController, 'loaned'])
    router.post('/:id/release', [InternoController, 'release'])
    router.post('/:id/returned', [InternoController, 'returned'])
    router.post('/:id/available', [InternoController, 'available'])
  })
  .prefix('/internal/equipment')
  .where('id', /^[1-9][0-9]*$/)
  .use(middleware.interno())
