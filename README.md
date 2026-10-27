# UniEquipos · Grupo 3

Sistema universitario para gestionar equipos, reservas, préstamos y mantenimiento. Proyecto de Arquitectura de Software de Adonis Alegría y Pamela Tapia, organizado con Clean Architecture.

## Requisitos e inicio

Necesitas Docker Desktop en ejecución, Docker Compose y Node.js 24 para generar la configuración inicial. Ejecuta los comandos desde esta carpeta (`PROGRAMA`).

```sh
node scripts/setup-env.mjs
docker compose up --build -d
```

El primer comando crea `.env` con claves aleatorias si todavía no existe. Si ya tienes el proyecto configurado, conserva ese archivo. Docker instala las dependencias y compila el frontend dentro de sus imágenes.

| Acceso local | Dirección |
| --- | --- |
| Sistema | http://localhost:8088 |
| Base de datos en phpMyAdmin | http://localhost:8089 |
| MySQL para clientes de escritorio | `127.0.0.1:3307` |

phpMyAdmin usa automáticamente la cuenta de MySQL configurada en `.env`. Para otros clientes, consulta allí `MYSQL_DATABASE`, `MYSQL_USER` y `MYSQL_PASSWORD`. Las cuentas del sistema son distintas de las credenciales de MySQL.

Los puertos se configuran mediante `APP_PORT`, `PMA_PORT` y `DB_PORT`. Si cambias el puerto del sistema, ajusta también `APP_ORIGIN`. Los accesos publicados están limitados a la computadora local.

## Cuentas de desarrollo

En una instalación nueva, carga los datos iniciales después de arrancar los contenedores:

```sh
docker compose exec -e DEMO_PASSWORD='DemoEquipos2026!' api php bin/seed.php
docker compose exec -e INITIAL_PASSWORD='Inicio2026!' api php bin/seed-course-users.php
```

Estos comandos crean las cuentas y los equipos de ejemplo que falten; no reemplazan registros ni contraseñas existentes. Los correos son ejemplos locales, no correos institucionales verificados.

| Cuenta | Correo | Contraseña inicial |
| --- | --- | --- |
| Administrador | `administrador@demo.uniequipos.test` | `DemoEquipos2026!` |
| Encargado | `encargado@demo.uniequipos.test` | `DemoEquipos2026!` |
| Adonis · Estudiante | `adonis.alegria@demo.uniequipos.test` | `Inicio2026!` |
| Kevin · Docente | `kevin.chuquitarco@demo.uniequipos.test` | `Inicio2026!` |

Las demás cuentas del curso están definidas en `backend/database/course-users.json` y usan la contraseña inicial del segundo comando al crearse.

## Funcionamiento general

- **Catálogo:** consulta de equipos por unidad física, con código automático, imágenes y estado. Administrador y encargado pueden agregar, modificar y deshabilitar unidades conservando su historial.
- **Reservas:** estudiantes y docentes seleccionan equipo, horario, motivo y docente responsable. El sistema valida disponibilidad y evita cruces de horarios.
- **Aprobaciones:** revisión sucesiva del docente responsable, administrador —que actualmente representa al jefe de laboratorio— y encargado. Un rechazo detiene la solicitud.
- **Préstamos:** una reserva aceptada permite iniciar el uso dentro del horario y registrar la devolución, incluso anticipada. Ambas operaciones requieren foto. El administrador dispone de acciones de prueba para iniciar fuera del horario o registrar la devolución por otra cuenta.
- **Mantenimiento:** al devolver el equipo pasa a mantenimiento. Administrador o encargado registran comentarios y foto de revisión para habilitarlo de nuevo.
- **Reportes:** historial y cantidad de préstamos por dispositivo, con exportación Excel general o individual.

Las vistas reciben cambios automáticamente mediante SSE. Los horarios se presentan en hora de Ecuador. Una unidad prestada, en mantenimiento, fuera de servicio o deshabilitada no puede entregarse; las reservas futuras también se consideran al consultar disponibilidad.

## Estructura y arquitectura

Tecnologías: React, JavaScript y Tailwind CSS; API PHP 8.4 con PDO y autenticación JWT en cookie HttpOnly; MySQL 8.4; Nginx y Docker Compose.

```text
PROGRAMA/
├── backend/
│   ├── src/
│   │   ├── Domain/          Entidades y reglas de negocio
│   │   ├── Application/     Casos de uso e interfaces (Ports)
│   │   ├── Adapters/Http/   Controladores y respuestas HTTP
│   │   └── Infrastructure/ Persistencia, seguridad, fotos y Excel
│   ├── database/           Migraciones y datos iniciales
│   ├── bin/                Carga de cuentas y equipos de ejemplo
│   ├── public/             Entrada pública de la API
│   └── tests/              Pruebas existentes del backend
├── frontend/src/
│   ├── domain/             Reglas y conceptos de la interfaz
│   ├── application/        Operaciones de aplicación
│   ├── infrastructure/     Cliente API, fotos y modo demo
│   └── presentation/       Páginas, componentes y estilos
├── infra/                  Configuración de Nginx y PHP-FPM
├── scripts/                Configuración, respaldo y comprobación de API
├── docs/openapi.yaml       Contrato de la API
├── .github/                Automatización de pruebas
├── .env.example            Plantilla de configuración
└── compose.yaml            Servicios y volumen de MySQL
```

Para ampliar el sistema, coloca las reglas en `Domain`, los casos de uso y puertos en `Application`, las implementaciones concretas en `Infrastructure` y la entrada HTTP en `Adapters`. Dominio y aplicación no deben depender de SQL ni HTTP. `backend/bootstrap.php` conecta las dependencias. Los permisos siempre se comprueban también en el backend.

## Operación y conservación de datos

```sh
# Iniciar una instalación ya construida
docker compose up -d

# Incorporar cambios del código a los contenedores
docker compose up --build -d

# Detener conservando la base de datos
docker compose down

# Crear respaldo SQL en backups/
sh scripts/backup.sh
```

Los datos y las fotos se guardan en MySQL, dentro del volumen `mysql_data`. No uses `docker compose down -v` si quieres conservarlos. Guarda `.env` de forma privada y no lo subas al repositorio.

Las migraciones se ejecutan automáticamente únicamente al crear una base vacía. En una base existente, aplica solo las migraciones pendientes y respalda antes. La migración `004_return_maintenance.sql` es una adaptación de datos de una sola ejecución: repetirla podría devolver a mantenimiento equipos ya revisados.

## Desarrollo local opcional

Para trabajar en el frontend fuera de Docker:

```sh
cd frontend
npm ci
npm run dev
```

El proxy de Vite utiliza la API en `localhost:8088`. Configura `APP_ORIGIN=http://localhost:5173` en `.env` y recrea la API con `docker compose up -d --force-recreate api` desde la raíz. Si Vite asigna otro puerto, usa ese origen. Para volver al sistema de Docker, restaura `APP_ORIGIN=http://localhost:8088` y recrea la API.

`npm run demo`, desde `frontend/`, abre una vista previa independiente con datos en memoria que se pierden al recargar. Usa las cuentas `administrador`, `encargado`, `estudiante` o `docente` bajo `@demo.uniequipos.test`, con contraseña `DemoEquipos2026!`.

Las carpetas locales `node_modules`, `vendor` y `dist` son generadas y no forman parte del código entregable. Se recuperan con `npm ci`, `composer install` y la compilación correspondiente; Docker genera sus propias copias. Se conservan los archivos de bloqueo de dependencias y las pruebas existentes.
