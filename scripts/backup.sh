#!/bin/sh
set -eu
# Ejecutar desde la raíz del proyecto. Programar con el mecanismo del servidor.
mkdir -p backups
backup_file="backups/uniequipos-$(date +%Y%m%d-%H%M%S).sql"
trap 'rm -f "$backup_file.tmp"' EXIT HUP INT TERM
docker compose exec -T db sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysqldump --single-transaction --no-tablespaces -u "$MYSQL_USER" "$MYSQL_DATABASE"' > "$backup_file.tmp"
mv "$backup_file.tmp" "$backup_file"
printf 'Respaldo creado: %s\n' "$backup_file"
