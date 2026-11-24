# Guía de pruebas · UniEquipos Microservicios

Esta guía es para la persona con el rol de **tester**. Su trabajo es comprobar que lo que llega a `develop` funciona, pasarlo a `test`, registrar lo que encuentre y, si todo está bien, aprobar el paso a `main`.

## 1. Preparar el entorno

Requisitos: Git, Docker Desktop, Node.js 24 y Postman.

```sh
git clone https://github.com/avalegria-cmyk/ArquitecturaDeSoftware_Proyecto.git
cd ArquitecturaDeSoftware_Proyecto
git checkout test
git checkout -b test/integracion
```

Para traer lo último de `develop` a tu rama de pruebas:

```sh
git merge origin/develop
```

Levanta el sistema y carga los datos del monolito:

```sh
node docker/setup-env.mjs
docker compose up --build -d
docker compose --profile migracion run --rm migracion
```

La primera construcción tarda varios minutos. Para comprobar que todo arrancó, abre [localhost:3000/api/health](http://localhost:3000/api/health): los 7 servicios deben decir `ok`.

## 2. Pruebas automáticas con Postman

1. En Postman, importa `docs/postman/UniEquipos-Microservicios.postman_collection.json`.
2. Abre la colección y elige **Run collection**. Ejecuta todas las carpetas en orden (0 a 7).
3. Resultado esperado: 41 peticiones y 56 verificaciones en verde.

La colección recorre el ciclo completo: crea un equipo, lo reserva un estudiante, lo aprueban el docente, el jefe y el encargado, se presta y se devuelve con foto, se revisa en mantenimiento y aparece en el reporte. Al final deshabilita el equipo de prueba. Se puede ejecutar varias veces.

Si haces peticiones a mano a `http://localhost:3000`, todo `POST` necesita las cabeceras `X-Requested-With: UniEquipos` y `Content-Type: application/json`. Postman guarda la cookie de sesión solo después del login.

## 3. Pruebas manuales en la aplicación

Abre [localhost:8088](http://localhost:8088). Las cuentas están en el README.

| # | Rol | Qué probar | Resultado esperado |
|---|---|---|---|
| 1 | Estudiante | Iniciar sesión y abrir **Reservas** | Ve solo sus reservas |
| 2 | Estudiante | Reservar un equipo en un horario futuro | Queda "en revisión", pendiente del docente |
| 3 | Estudiante | Reservar el mismo equipo en un horario que se cruza | Mensaje de equipo no disponible |
| 4 | Docente | **Aprobaciones** → aprobar la reserva | Pasa a la fase del jefe de laboratorio |
| 5 | Administrador | Aprobar como jefe de laboratorio | Pasa a la fase del encargado |
| 6 | Encargado | Aprobar | Reserva aceptada |
| 7 | Estudiante | **Préstamos** → iniciar uso con foto (en el horario reservado) | Equipo "En préstamo" en el catálogo |
| 8 | Estudiante | Devolver con foto | Equipo "En mantenimiento" |
| 9 | Encargado | **Mantenimiento** → revisión con foto y comentario | Equipo "Disponible" |
| 10 | Encargado | **Reportes** → exportar Excel | Archivo con 4 hojas |
| 11 | Administrador | **Catálogo** → crear, editar y deshabilitar un equipo | Cambios visibles sin recargar en otra pestaña (SSE) |
| 12 | Cualquiera | **Mi perfil** → cambiar contraseña | Cierra la sesión y entra con la nueva clave |

## 4. Pruebas de resiliencia

Sirven para mostrar las características de los microservicios que vimos en las diapositivas.

| Prueba | Comando | Qué debe pasar |
|---|---|---|
| Un servicio cae | `docker compose stop reportes` | Reportes responde 503 con mensaje claro y el resto del sistema sigue funcionando |
| Catálogo cae | `docker compose stop catalogo` | Mis reservas se siguen mostrando con la copia local del equipo |
| Estado general | abrir `/api/health` con un servicio detenido | `status: degradado` y ese servicio como `caido` |
| Recuperación | `docker compose start reportes catalogo` | Todo vuelve a funcionar sin reiniciar nada más |
| Logs con correlación | `docker compose logs gateway` | Cada petición tiene método, ruta, código, tiempo y `correlacion=` |
| Despliegue independiente | cambiar un servicio y `docker compose up --build -d reportes` | Solo se reconstruye ese servicio |

## 5. Registrar resultados y aprobar

1. Si algo falla, crea un **Issue** en GitHub con estos datos: servicio, pasos para reproducirlo, resultado esperado y resultado obtenido (con captura o respuesta de Postman).
2. Si todo pasa, sube tus evidencias (capturas o el reporte de Postman exportado) a tu rama:

   ```sh
   git add .
   git commit -m "Pruebas de integración de los microservicios"
   git push -u origin test/integracion
   ```

3. En GitHub, abre un **Pull Request** de `test/integracion` hacia `test`. Revisa los cambios, comenta y aprueba (**Review changes → Approve**) antes del merge.
4. Cuando `test` esté aprobado, abre el Pull Request de `test` hacia `main`.

GitHub Actions ejecuta en cada push las pruebas de los 9 componentes (frontend, gateway y 7 servicios). Revisa en la pestaña **Actions** que estén en verde antes de aprobar.
