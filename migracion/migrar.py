"""Migración de datos del monolito a las bases de los microservicios.

Paso del patrón Strangler: primero se crea la base nueva, luego se copian los datos
y después el servicio empieza a escribir en su propia base. Cada paso solo copia si la
base destino está vacía, así se puede ejecutar muchas veces sin duplicar nada.
"""
import os
import time

import re
import sqlite3

import psycopg
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


def postgres(url):
    return esperar(lambda: psycopg.connect(url, autocommit=True), "PostgreSQL")


def esperar_tabla_pg(cx, tabla):
    for _ in range(60):
        if cx.execute("SELECT to_regclass(%s)", (tabla,)).fetchone()[0]:
            return
        time.sleep(2)
    raise RuntimeError(f"La tabla {tabla} no existe todavía")


def utc(fecha):
    from datetime import timezone
    return fecha.replace(tzinfo=timezone.utc) if fecha else None


def reservas(origen):
    with postgres(os.environ["RESERVAS_DATABASE_URL"]) as cx:
        esperar_tabla_pg(cx, "reservation_events")
        if cx.execute("SELECT COUNT(*) FROM reservations").fetchone()[0]:
            print("reservas: ya tiene datos, se conserva.")
            return
        with origen.cursor() as src, cx.transaction():
            # Se guardan copias de nombre/correo y de los datos del equipo: ya no hay JOIN entre servicios.
            src.execute("""SELECT r.*, u.name AS requester_name, u.email AS requester_email,
                t.name AS teacher_name, t.email AS teacher_email, e.code, e.name AS equipment_name,
                e.category, e.location, l.id AS loan_id, l.started_at, l.returned_at
                FROM reservations r JOIN users u ON u.id = r.requester_id JOIN users t ON t.id = r.teacher_id
                JOIN equipment e ON e.id = r.equipment_id LEFT JOIN loans l ON l.reservation_id = r.id ORDER BY r.id""")
            filas = src.fetchall()
            src.execute("""SELECT ev.*, u.name AS actor_name FROM reservation_events ev
                JOIN users u ON u.id = ev.actor_id ORDER BY ev.id""")
            eventos = src.fetchall()
            for r in filas:
                cx.execute("""INSERT INTO reservations (id, requester_id, requester_name, requester_email, teacher_id, teacher_name,
                    teacher_email, equipment_id, equipment_code, equipment_name, equipment_category, equipment_location,
                    starts_at, ends_at, purpose, status, request_key, created_at, loan_id, loan_started_at, loan_returned_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (r["id"], r["requester_id"], r["requester_name"], r["requester_email"], r["teacher_id"], r["teacher_name"],
                     r["teacher_email"], r["equipment_id"], r["code"], r["equipment_name"], r["category"], r["location"],
                     utc(r["starts_at"]), utc(r["ends_at"]), r["purpose"], r["status"], r["request_key"], utc(r["created_at"]),
                     r["loan_id"], utc(r["started_at"]), utc(r["returned_at"])))
            for e in eventos:
                cx.execute("""INSERT INTO reservation_events (id, reservation_id, step, outcome, actor_id, actor_name, note, created_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""", (e["id"], e["reservation_id"], e["step"], e["outcome"],
                    e["actor_id"], e["actor_name"], e["note"], utc(e["created_at"])))
            for tabla in ("reservations", "reservation_events"):
                cx.execute(f"SELECT setval(pg_get_serial_sequence('{tabla}', 'id'), GREATEST((SELECT MAX(id) FROM {tabla}), 1))")
        print(f"reservas: {len(filas)} reservas y {len(eventos)} eventos copiados.")


def prestamos(origen):
    with postgres(os.environ["PRESTAMOS_DATABASE_URL"]) as cx:
        esperar_tabla_pg(cx, "loan_photos")
        if cx.execute("SELECT COUNT(*) FROM loans").fetchone()[0]:
            print("prestamos: ya tiene datos, se conserva.")
            return
        with origen.cursor() as src, cx.transaction():
            src.execute("""SELECT l.*, r.requester_id, r.teacher_id, u.name AS requester_name FROM loans l
                JOIN reservations r ON r.id = l.reservation_id JOIN users u ON u.id = r.requester_id ORDER BY l.id""")
            filas = src.fetchall()
            src.execute("SELECT * FROM loan_photos ORDER BY id")
            fotos = src.fetchall()
            for l in filas:
                cx.execute("""INSERT INTO loans (id, reservation_id, equipment_id, requester_id, requester_name, teacher_id, started_at, returned_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""", (l["id"], l["reservation_id"], l["equipment_id"], l["requester_id"],
                    l["requester_name"], l["teacher_id"], utc(l["started_at"]), utc(l["returned_at"])))
            for f in fotos:
                cx.execute("""INSERT INTO loan_photos (id, loan_id, phase, content, width, height, byte_size, created_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""", (f["id"], f["loan_id"], f["phase"], f["content"], f["width"],
                    f["height"], f["byte_size"], utc(f["created_at"])))
            for tabla in ("loans", "loan_photos"):
                cx.execute(f"SELECT setval(pg_get_serial_sequence('{tabla}', 'id'), GREATEST((SELECT MAX(id) FROM {tabla}), 1))")
        print(f"prestamos: {len(filas)} préstamos y {len(fotos)} fotos copiados.")


def mantenimiento(origen):
    ruta = os.environ["MANTENIMIENTO_DB_PATH"]
    for _ in range(60):
        if os.path.exists(ruta):
            break
        time.sleep(2)
    cx = sqlite3.connect(ruta, timeout=10)
    try:
        for _ in range(60):
            if cx.execute("SELECT name FROM sqlite_master WHERE name = 'maintenance_reviews'").fetchone():
                break
            time.sleep(2)
        if cx.execute("SELECT COUNT(*) FROM maintenance_reviews").fetchone()[0]:
            print("mantenimiento: ya tiene datos, se conserva.")
            return
        with origen.cursor() as src:
            src.execute("""SELECT m.*, e.code, e.name AS equipment_name, u.name AS reviewer_name FROM maintenance_reviews m
                JOIN equipment e ON e.id = m.equipment_id JOIN users u ON u.id = m.reviewer_id ORDER BY m.id""")
            filas = src.fetchall()
        with cx:
            cx.executemany("""INSERT INTO maintenance_reviews (id, equipment_id, equipment_code, equipment_name, loan_id,
                reviewer_id, reviewer_name, comments, photo, reviewed_at) VALUES (?,?,?,?,?,?,?,?,?,?)""",
                [(m["id"], m["equipment_id"], m["code"], m["equipment_name"], m["loan_id"], m["reviewer_id"], m["reviewer_name"],
                  m["comments"], m["photo"], m["reviewed_at"].strftime("%Y-%m-%dT%H:%M:%SZ")) for m in filas])
        print(f"mantenimiento: {len(filas)} revisiones copiadas.")
    finally:
        cx.close()
        # Los archivos de SQLite deben seguir perteneciendo al usuario del servicio.
        dueño = os.stat(ruta)
        for extra in ("-wal", "-shm"):
            if os.path.exists(ruta + extra):
                os.chown(ruta + extra, dueño.st_uid, dueño.st_gid)


PASOS = [identidad, catalogo, reservas, prestamos, mantenimiento]

if __name__ == "__main__":
    origen = monolito()
    for paso in PASOS:
        paso(origen)
    print("Migración terminada.")
