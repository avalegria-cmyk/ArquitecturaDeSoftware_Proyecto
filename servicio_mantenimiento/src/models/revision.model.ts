import { db } from "../config/database";

export interface Revision {
  id: number;
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  loan_id: number | null;
  reviewer_id: number;
  reviewer_name: string;
  comments: string;
  reviewed_at: string;
}

const COLUMNAS = "id, equipment_id, equipment_code, equipment_name, loan_id, reviewer_id, reviewer_name, comments, reviewed_at";

export const Revisiones = {
  crear(datos: Omit<Revision, "id"> & { photo: Uint8Array }): number {
    const r = db
      .query(`INSERT INTO maintenance_reviews (equipment_id, equipment_code, equipment_name, loan_id, reviewer_id, reviewer_name, comments, photo, reviewed_at)
              VALUES ($equipment_id, $equipment_code, $equipment_name, $loan_id, $reviewer_id, $reviewer_name, $comments, $photo, $reviewed_at)`)
      .run({
        $equipment_id: datos.equipment_id, $equipment_code: datos.equipment_code, $equipment_name: datos.equipment_name,
        $loan_id: datos.loan_id, $reviewer_id: datos.reviewer_id, $reviewer_name: datos.reviewer_name,
        $comments: datos.comments, $photo: datos.photo, $reviewed_at: datos.reviewed_at,
      });
    return Number(r.lastInsertRowid);
  },
  eliminar(id: number) {
    db.query("DELETE FROM maintenance_reviews WHERE id = ?").run(id);
  },
  todas(equipmentId?: number): Revision[] {
    return equipmentId
      ? (db.query(`SELECT ${COLUMNAS} FROM maintenance_reviews WHERE equipment_id = ? ORDER BY reviewed_at DESC, id DESC`).all(equipmentId) as Revision[])
      : (db.query(`SELECT ${COLUMNAS} FROM maintenance_reviews ORDER BY reviewed_at DESC, id DESC`).all() as Revision[]);
  },
  foto(id: number): Uint8Array | null {
    const fila = db.query("SELECT photo FROM maintenance_reviews WHERE id = ?").get(id) as { photo: Uint8Array } | null;
    return fila?.photo ?? null;
  },
};
