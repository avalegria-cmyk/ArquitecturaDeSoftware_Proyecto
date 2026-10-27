-- Un préstamo por reserva y una sola unidad activa por código físico.
CREATE TABLE IF NOT EXISTS loans (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 reservation_id BIGINT UNSIGNED NOT NULL UNIQUE,
 equipment_id BIGINT UNSIGNED NOT NULL,
 started_at DATETIME NOT NULL,
 returned_at DATETIME NULL,
 active_equipment_id BIGINT UNSIGNED GENERATED ALWAYS AS
   (CASE WHEN returned_at IS NULL THEN equipment_id ELSE NULL END) STORED,
 UNIQUE KEY uq_active_equipment (active_equipment_id),
 FOREIGN KEY (reservation_id) REFERENCES reservations(id),
 FOREIGN KEY (equipment_id) REFERENCES equipment(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS loan_photos (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 loan_id BIGINT UNSIGNED NOT NULL,
 phase ENUM('inicio','devolucion') NOT NULL,
 content MEDIUMBLOB NOT NULL,
 width INT UNSIGNED NOT NULL,
 height INT UNSIGNED NOT NULL,
 byte_size INT UNSIGNED NOT NULL,
 created_at DATETIME NOT NULL,
 UNIQUE KEY uq_loan_photo_phase (loan_id, phase),
 FOREIGN KEY (loan_id) REFERENCES loans(id)
) ENGINE=InnoDB;
