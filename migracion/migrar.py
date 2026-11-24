"""Migración de datos del monolito a las bases de los microservicios.

Paso del patrón Strangler: primero se crea la base nueva, luego se copian los datos
y después el servicio empieza a escribir en su propia base. Cada paso solo copia si la
base destino está vacía, así se puede ejecutar muchas veces sin duplicar nada.
"""
import os
import time

import re

import pymysql
from pymongo import MongoClient


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


def catalogo(origen):
    cliente = esperar(lambda: _ping(MongoClient(os.environ["CATALOGO_MONGO_URL"], serverSelectionTimeoutMS=3000)), "MongoDB")
    db = cliente.get_default_database()
    if db.equipment.count_documents({}):
        print("catalogo: ya tiene datos, se conserva.")
        return
    with origen.cursor() as src:
        src.execute("SELECT * FROM equipment ORDER BY id")
        equipos = src.fetchall()
        src.execute("SELECT id, equipment_id, content, created_at FROM equipment_images ORDER BY id")
        imagenes = src.fetchall()
        src.execute("SELECT prefix, last_number FROM equipment_code_sequences")
        secuencias = {f["prefix"]: f["last_number"] for f in src.fetchall()}
    if equipos:
        db.equipment.insert_many([{"id": e["id"], "code": e["code"], "name": e["name"], "category": e["category"],
                                   "status": e["status"], "location": e["location"], "description": e["description"],
                                   "createdAt": e["created_at"]} for e in equipos])
    if imagenes:
        db.equipment_images.insert_many([{"id": i["id"], "equipmentId": i["equipment_id"], "content": i["content"],
                                          "createdAt": i["created_at"]} for i in imagenes])
    # Contadores: el siguiente id y el siguiente correlativo de cada prefijo de código.
    for e in equipos:
        coincide = re.fullmatch(r"([A-Z]+)-(\d+)", e["code"])
        if coincide:
            prefijo, numero = coincide.group(1), int(coincide.group(2))
            secuencias[prefijo] = max(secuencias.get(prefijo, 0), numero)
    contadores = {"equipment": max((e["id"] for e in equipos), default=0),
                  "image": max((i["id"] for i in imagenes), default=0)}
    contadores.update({f"code:{p}": n for p, n in secuencias.items()})
    for nombre, valor in contadores.items():
        db.counters.update_one({"_id": nombre}, {"$max": {"seq": valor}}, upsert=True)
    print(f"catalogo: {len(equipos)} equipos y {len(imagenes)} imágenes copiados.")


def _ping(cliente):
    cliente.admin.command("ping")
    return cliente


PASOS = [identidad, catalogo]

if __name__ == "__main__":
    origen = monolito()
    for paso in PASOS:
        paso(origen)
    print("Migración terminada.")
