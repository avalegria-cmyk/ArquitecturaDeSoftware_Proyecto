"""Migración de datos del monolito a las bases de los microservicios.

Paso del patrón Strangler: primero se crea la base nueva, luego se copian los datos
y después el servicio empieza a escribir en su propia base. Cada paso solo copia si la
base destino está vacía, así se puede ejecutar muchas veces sin duplicar nada.
"""
import os
import time

import pymysql


def esperar(conectar, descripcion, intentos=60):
    for _ in range(intentos):
        try:
            return conectar()
        except Exception:  # la base todavía arranca
            time.sleep(2)
    raise RuntimeError(f"No se pudo conectar a {descripcion}")


def mysql(host, base, usuario, clave):
    return esperar(lambda: pymysql.connect(host=host, database=base, user=usuario, password=clave,
                                           charset="utf8mb4", autocommit=False,
                                           cursorclass=pymysql.cursors.DictCursor), f"{host}/{base}")


def monolito():
    return mysql(os.environ["LEGACY_DB_HOST"], os.environ["LEGACY_DB_NAME"],
                 os.environ["LEGACY_DB_USER"], os.environ["LEGACY_DB_PASSWORD"])


def esperar_tabla(cursor, tabla):
    for _ in range(60):
        cursor.execute("SHOW TABLES LIKE %s", (tabla,))
        if cursor.fetchone():
            return
        time.sleep(2)
    raise RuntimeError(f"La tabla {tabla} no existe todavía")


def identidad(origen):
    destino = mysql(os.environ["MICRO_MYSQL_HOST"], "identidad_db", "identidad", os.environ["IDENTIDAD_DB_PASSWORD"])
    with destino.cursor() as cur, origen.cursor() as src:
        esperar_tabla(cur, "users")
        cur.execute("SELECT COUNT(*) AS n FROM users")
        if cur.fetchone()["n"]:
            print("identidad: ya tiene datos, se conserva.")
            return
        src.execute("SELECT id, name, email, password_hash, role, active, created_at, initial_password_hash FROM users")
        filas = src.fetchall()
        cur.executemany("""INSERT INTO users (id, name, email, password_hash, role, active, created_at, initial_password_hash)
            VALUES (%(id)s, %(name)s, %(email)s, %(password_hash)s, %(role)s, %(active)s, %(created_at)s, %(initial_password_hash)s)""", filas)
        destino.commit()
        print(f"identidad: {len(filas)} usuarios copiados.")


PASOS = [identidad]

if __name__ == "__main__":
    origen = monolito()
    for paso in PASOS:
        paso(origen)
    print("Migración terminada.")
