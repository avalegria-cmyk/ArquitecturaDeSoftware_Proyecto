# UniEquipos

Sistema universitario de inventario, reservas, aprobaciones, préstamos, mantenimiento y reportes. Proyecto del Grupo 3 para Arquitectura de Software, desarrollado con Clean Architecture.

## Ejecutar

Requisitos: Docker Desktop, Docker Compose y Node.js 24. Desde la raíz del proyecto:

```sh
node docker/setup-env.mjs
docker compose up --build -d
```

`setup-env.mjs` crea `.env` con claves aleatorias si no existe; nunca reemplaza la configuración actual. La aplicación está en [localhost:8088](http://localhost:8088) y phpMyAdmin en [localhost:8089](http://localhost:8089). MySQL acepta conexiones locales en `127.0.0.1:3307`; sus credenciales están en `.env`. Los puertos se pueden configurar allí.

Para detener los contenedores conservando los datos:

```sh
docker compose down
```

La base de datos y las fotos están en el volumen Docker `mysql_data`, fuera de Git. No ejecutes `docker compose down -v` si quieres conservarlas.

## Estructura

```text
PROGRAMA/
├── backend/
│   ├── src/
│   │   ├── Domain/          Entidades y reglas de negocio
│   │   ├── Application/     Casos de uso e interfaces de repositorio
│   │   ├── Adapters/Http/   Controladores y entrada HTTP
│   │   └── Infrastructure/ Implementaciones PDO, seguridad, fotos y Excel
│   ├── database/schema.sql  Definición completa de las 11 tablas
│   ├── database/data.sql    Datos exportados (sin sesiones de acceso)
│   ├── bin/                Carga inicial y adaptación de cuentas
│   │   └── fixtures/       Datos de ejemplo de esas cuentas y equipos
│   ├── public/             Entrada de la API
│   └── tests/              Pruebas existentes
├── frontend/src/
│   ├── domain/             Conceptos de la interfaz
│   ├── application/        Operaciones de aplicación
│   ├── infrastructure/     Cliente API y modo demo
│   └── presentation/
│       ├── modules/        Pantallas y componentes por función
│       ├── components/     Piezas compartidas
│       └── App.jsx         Navegación y composición
├── docker/                 Configuración de Nginx, PHP y entorno local
├── docs/openapi.yaml       Contrato de la API
└── compose.yaml            Servicios de la aplicación
```

Las reglas de negocio están en `Domain`. `Application` coordina esas reglas a través de interfaces; `Infrastructure` implementa el acceso a MySQL y otros detalles técnicos. Los controladores HTTP y React están en la parte externa. La autorización se verifica en el backend.

`docker/` contiene los archivos necesarios para los contenedores. `backend/bin/` contiene comandos para instalar o adaptar cuentas. `schema.sql` reúne todas las tablas en su estado final. `data.sql` contiene los datos exportados, incluidas cuentas y evidencias fotográficas, sin sesiones de acceso. Se incluye en Git y se excluye del contexto de Docker. Los JSON de `fixtures/` siguen siendo datos iniciales de ejemplo.

## Cuentas de desarrollo

En una instalación nueva, después de arrancar Docker:

```sh
docker compose exec -e DEMO_PASSWORD='DemoEquipos2026!' api php bin/seed.php
docker compose exec -e INITIAL_PASSWORD='Inicio2026!' api php bin/seed-course-users.php
```

Estas cargas crean únicamente registros faltantes. Las cuentas de demostración son `administrador@demo.uniequipos.test` y `encargado@demo.uniequipos.test`, con contraseña `DemoEquipos2026!`. El docente Kevin usa `kevin.chuquitarco@demo.uniequipos.test` y `Inicio2026!`.

Cada estudiante usa como usuario la inicial del primer nombre, la inicial del segundo nombre y el primer apellido, en minúsculas. El correo añade `@espe.edu.ec` y la contraseña inicial es el mismo usuario. Ejemplo: `avalegria@espe.edu.ec` / `avalegria`. Las cuentas completas están en `backend/bin/fixtures/course-users.json`.

Cada persona puede cambiar su contraseña desde **Mi perfil**. El administrador puede restablecer la clave inicial desde **Usuarios**; ambas acciones cierran las sesiones de la cuenta afectada.

## Navegación y módulos

Cada módulo tiene una URL directa: `/`, `/equipos`, `/reservas`, `/aprobaciones`, `/prestamos`, `/mantenimiento`, `/reportes`, `/usuarios` y `/perfil`. Puedes recargar, compartir enlaces y usar Atrás/Adelante. El menú solo muestra módulos autorizados para el rol y el backend mantiene sus controles de acceso.

El catálogo registra una unidad física por código; estudiantes y docentes solicitan reservas con horario y docente responsable. Las aprobaciones siguen la fase docente, administrador y encargado. El préstamo registra foto al iniciar y devolver. La devolución pone el equipo en mantenimiento; la revisión con foto y comentario puede habilitarlo de nuevo. Reportes muestra el historial y exporta archivos Excel. Las vistas reciben actualizaciones por SSE.

## Base existente y desarrollo local

`schema.sql` se aplica automáticamente solo cuando el volumen MySQL está vacío. No modifica la base actual. Para restaurar los datos exportados sobre un esquema recién creado y vacío, ejecuta desde la raíz del proyecto: `docker compose exec -T db sh -c 'exec mysql -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < backend/database/data.sql`. Hazlo antes de ejecutar las cargas iniciales de `backend/bin/` para no duplicar cuentas. La importación restaura los registros históricos de la fecha de exportación, sin sesiones de acceso. `bin/update-student-accounts.php` y `bin/configure-initial-passwords.php` quedan disponibles para adaptar instalaciones antiguas; en esta base local los cambios ya se aplicaron.

Para desarrollar el frontend fuera de Docker, ejecuta `npm ci` y `npm run dev` dentro de `frontend/`. Vite usa la API en `localhost:8088`; ajusta `APP_ORIGIN` al puerto de Vite si necesitas iniciar sesión desde el servidor de desarrollo. `npm run demo` abre una vista previa independiente con datos en memoria.

`node_modules`, `vendor`, `dist` y `.env` son archivos locales generados o privados y no se incluyen en Git. El repositorio conserva el código, los archivos de bloqueo de dependencias, las cargas iniciales, el esquema SQL y el script de datos.
