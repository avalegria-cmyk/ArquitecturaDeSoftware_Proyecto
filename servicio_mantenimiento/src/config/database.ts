import { Database } from "bun:sqlite";

// Base privada del servicio de Mantenimiento: un archivo SQLite dentro de su volumen.
export const db = new Database(process.env.DB_PATH ?? "mantenimiento.db", { create: true });
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA busy_timeout = 5000");

db.run(`CREATE TABLE IF NOT EXISTS maintenance_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  equipment_id INTEGER NOT NULL,
  equipment_code TEXT NOT NULL,
  equipment_name TEXT NOT NULL,
  loan_id INTEGER,
  reviewer_id INTEGER NOT NULL,
  reviewer_name TEXT NOT NULL,
  comments TEXT NOT NULL CHECK (length(comments) <= 2000),
  photo BLOB NOT NULL,
  reviewed_at TEXT NOT NULL
)`);
db.run("CREATE INDEX IF NOT EXISTS idx_equipment_reviewed ON maintenance_reviews (equipment_id, reviewed_at)");
