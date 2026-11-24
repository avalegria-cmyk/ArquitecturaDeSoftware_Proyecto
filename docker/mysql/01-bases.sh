#!/bin/sh
# Un solo servidor MySQL para los microservicios, pero cada servicio tiene su base y su usuario:
# ninguno puede leer la base de otro (Database per Service).
set -e
mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE DATABASE IF NOT EXISTS identidad_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'identidad'@'%' IDENTIFIED BY '${IDENTIDAD_DB_PASSWORD}';
GRANT ALL PRIVILEGES ON identidad_db.* TO 'identidad'@'%';
CREATE DATABASE IF NOT EXISTS reportes_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'reportes'@'%' IDENTIFIED BY '${REPORTES_DB_PASSWORD}';
GRANT ALL PRIVILEGES ON reportes_db.* TO 'reportes'@'%';
FLUSH PRIVILEGES;
SQL
