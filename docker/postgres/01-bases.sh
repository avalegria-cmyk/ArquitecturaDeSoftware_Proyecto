#!/bin/sh
# PostgreSQL de los microservicios: reservas_db y prestamos_db, cada una con su propio usuario.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<SQL
CREATE USER reservas WITH PASSWORD '${RESERVAS_DB_PASSWORD}';
CREATE DATABASE reservas_db OWNER reservas;
REVOKE ALL ON DATABASE reservas_db FROM PUBLIC;
CREATE USER prestamos WITH PASSWORD '${PRESTAMOS_DB_PASSWORD}';
CREATE DATABASE prestamos_db OWNER prestamos;
REVOKE ALL ON DATABASE prestamos_db FROM PUBLIC;
SQL
