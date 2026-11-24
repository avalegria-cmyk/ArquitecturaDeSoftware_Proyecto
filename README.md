# UniEquipos · Microservicios

Sistema universitario de inventario, reservas, aprobaciones, préstamos, mantenimiento y reportes. Proyecto del Grupo 3 para Arquitectura de Software (Unidad 2).

El proyecto empezó como un **monolito** (PHP 8.4 con Clean Architecture y una sola base MySQL de 11 tablas). En esta versión se descompuso en **7 microservicios**, cada uno con su propio lenguaje y su propia base de datos, detrás de un **API Gateway**.

## Arquitectura

```text
Navegador ─► web :8088 (Nginx + React) ─► API Gateway :3000 (Spring Boot)
                                              │  autenticación, enrutamiento, límite de intentos,
                                              │  circuit breaker, reintentos y logs con correlación
   ┌──────────────┬──────────────┬────────────┼─────────────┬───────────────┬──────────────┐
   ▼              ▼              ▼            ▼             ▼               ▼              ▼
Identidad     Catálogo       Reservas     Préstamos    Mantenimiento     Reportes    Notificaciones
PHP 8.4       AdonisJS       NestJS       Rust         Bun + Fastify     FastAPI     Go
:3001         :3002          :3003        :3004        :3005             :3006       :3007 (SSE)
MySQL         MongoDB        PostgreSQL   PostgreSQL   SQLite            MySQL       sin base
identidad_db  catalogo_db    reservas_db  prestamos_db mantenimiento.db  reportes_db
```

| Servicio | Tecnología | Responsabilidad | Tablas / colecciones |
|---|---|---|---|
| `api-gateway` | Java 21, Spring Cloud Gateway, Resilience4j | Punto único de entrada | — |
| `servicio_identidad` | PHP 8.4 (Clean Architecture del monolito) | Login con JWT en cookie, sesiones, contraseñas, usuarios | `users`, `auth_sessions` |
| `servicio_catalogo` | AdonisJS 7 + Mongoose | Equipos, imágenes, códigos y estado de cada unidad | `equipment`, `equipment_images`, `counters` |
| `servicio_reservas` | NestJS 12 + pg | Solicitudes con horario y aprobación en 3 fases | `reservations`, `reservation_events` |
| `servicio_prestamos` | Rust (Axum + SQLx) | Inicio y devolución con foto de evidencia | `loans`, `loan_photos` |
| `servicio_mantenimiento` | Bun + Fastify + `bun:sqlite` | Revisión de equipos devueltos | `maintenance_reviews` |
| `servicio_reportes` | Python FastAPI + Uvicorn + SQLAlchemy | Historial, exportación a Excel y bitácora central | `audit_logs` |
| `servicio_notificaciones` | Go (net/http) | Avisos en tiempo real por SSE | — |

### Decisiones de diseño

- **Descomposición por dominio de negocio (DDD).** Cada servicio es un *bounded context* con su lógica, sus datos y su API (descomposición vertical). No se dividió por capas técnicas.
- **Database per Service.** Ningún servicio lee la base de otro. Hay un servidor por motor (MySQL, PostgreSQL y MongoDB), pero cada servicio tiene su propia base y un usuario que solo puede entrar a ella. Las claves foráneas entre módulos pasaron a ser IDs que se validan por REST, y cada servicio guarda una copia de los datos que muestra (por ejemplo, el nombre del docente en la reserva).
- **Comunicación REST con JSON**, como en la práctica (`servicio_factura` → cliente/producto). Las URL de los otros servicios van en variables de entorno.
- **Seguridad centralizada en el gateway.** El gateway valida la cookie con Identidad y envía el usuario a cada servicio en las cabeceras `X-User-*`, firmadas con `X-Internal-Token`. Las rutas `/internal/**` no se exponen al navegador.
- **Resiliencia.** Circuit Breaker y Retry en el gateway (Resilience4j), Circuit Breaker propio en Reservas → Catálogo/Identidad, timeouts en todas las llamadas y degradación controlada (si Catálogo no responde, Reservas muestra la copia local del equipo).
- **Saga con compensación.** Al iniciar un préstamo, primero se guarda en `prestamos_db`, después Catálogo marca la unidad como prestada y, si algo falla, se compensa (`/release`). Mantenimiento hace lo mismo al habilitar una unidad.
- **Consistencia eventual.** Préstamos informa a Reservas cuando inicia o termina un préstamo (con reintentos). Todos los servicios envían su bitácora a Reportes y sus avisos a Notificaciones.
- **Composición de APIs.** Reportes arma el historial pidiendo datos a Catálogo, Préstamos, Reservas y Mantenimiento (reemplaza los JOIN del monolito). `GET /api/health` en el gateway agrega el estado de todos los servicios.

### Migración con el patrón Strangler

La migración se hizo por fases. En cada fase el gateway dejaba de enviar un módulo al monolito y lo enviaba al servicio nuevo, y el monolito siguió funcionando hasta quedar vacío:

1. API Gateway delante del monolito
2. Notificaciones (Go)
3. Identidad (PHP)
4. Catálogo (AdonisJS + MongoDB)
5. Reservas (NestJS + PostgreSQL)
6. Préstamos (Rust + PostgreSQL)
7. Mantenimiento (Bun + SQLite)
8. Reportes (FastAPI + MySQL)
9. Retiro del monolito

Cada fase está en su rama `feature/...` y en su merge a `develop`. Los datos del monolito se copian con la herramienta `migracion/`.

## Ejecutar

Requisitos: Docker Desktop y Node.js 24. Desde la raíz del proyecto:

```sh
node docker/setup-env.mjs
docker compose up --build -d
docker compose --profile migracion run --rm migracion
```

1. `setup-env.mjs` crea `.env` con claves aleatorias. Si `.env` ya existe, solo agrega las variables que falten.
2. `up` construye y arranca los 7 servicios, el gateway, el frontend y las 3 bases. La primera vez tarda varios minutos porque compila Java, Rust y las imágenes de Node, Bun, Python, Go y PHP.
3. `migracion` levanta la base del monolito con `migracion/legado/*.sql` y copia sus datos a la base de cada servicio. Solo copia si la base destino está vacía, así que se puede repetir sin duplicar datos.

| Dirección | Para qué |
|---|---|
| [localhost:8088](http://localhost:8088) | Aplicación |
| [localhost:3000](http://localhost:3000) | API Gateway (Postman) |
| [localhost:3000/api/health](http://localhost:3000/api/health) | Estado de todos los microservicios |
| [localhost:8089](http://localhost:8089) | phpMyAdmin (MySQL de Identidad y Reportes) |

Para detenerlo conservando los datos: `docker compose down`. Con `docker compose down -v` se borran las bases.

## Cuentas de desarrollo

Después de la migración están las cuentas del monolito:

- `administrador@demo.uniequipos.test` y `encargado@demo.uniequipos.test`, con contraseña `DemoEquipos2026!`.
- El docente Kevin entra con `kevin.chuquitarco@demo.uniequipos.test` y `Inicio2026!`.
- Cada estudiante usa su correo `@espe.edu.ec` y, como contraseña inicial, su usuario. Ejemplo: `avalegria@espe.edu.ec` / `avalegria`.

## Ramas y flujo de trabajo

| Rama | Entorno | Uso |
|---|---|---|
| `main` | Producción | Solo versiones probadas |
| `test` | Pruebas | La tester prueba lo integrado antes de pasarlo a `main` |
| `develop` | Desarrollo | Donde se integran los servicios terminados |
| `feature/...` | — | Una rama por microservicio |

El flujo es `feature/...` → `develop` → Pull Request a `test` (revisión y pruebas) → Pull Request a `main`. GitHub Actions prueba cada servicio por separado en cada push. La guía para probar está en [docs/GUIA_PRUEBAS.md](docs/GUIA_PRUEBAS.md) y la colección de Postman en [docs/postman](docs/postman).

## Estructura

```text
PROGRAMAu2/
├── api-gateway/               Spring Cloud Gateway
├── servicio_identidad/        PHP 8.4
├── servicio_catalogo/         AdonisJS + MongoDB
├── servicio_reservas/         NestJS + PostgreSQL
├── servicio_prestamos/        Rust + PostgreSQL
├── servicio_mantenimiento/    Bun + Fastify + SQLite
├── servicio_reportes/         Python FastAPI + MySQL
├── servicio_notificaciones/   Go
├── frontend/                  React 19 + Vite (sin cambios: las rutas /api se conservaron)
├── migracion/                 Copia de datos del monolito (legado/ = esquema y datos exportados)
├── docker/                    Nginx del frontend e inicialización de MySQL, PostgreSQL y MongoDB
├── docs/                      Guía de pruebas, Postman y contrato OpenAPI
└── compose.yaml
```
