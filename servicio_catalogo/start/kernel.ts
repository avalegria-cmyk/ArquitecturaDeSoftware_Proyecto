import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

server.errorHandler(() => import('#exceptions/handler'))

server.use([
  () => import('#middleware/force_json_response_middleware'),
  () => import('#middleware/container_bindings_middleware'),
])

router.use([() => import('@adonisjs/core/bodyparser_middleware')])

export const middleware = router.named({
  // Solo el API Gateway y los microservicios conocen el token interno.
  interno: () => import('#middleware/interno_middleware'),
  // Identidad del usuario que el gateway ya validó (cabeceras X-User-*).
  usuario: () => import('#middleware/usuario_middleware'),
})
