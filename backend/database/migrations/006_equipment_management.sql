ALTER TABLE equipment MODIFY status ENUM('disponible','prestado','mantenimiento','fuera_servicio','deshabilitado') NOT NULL DEFAULT 'disponible';
CREATE TABLE IF NOT EXISTS equipment_images (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 equipment_id BIGINT UNSIGNED NOT NULL,
 content MEDIUMBLOB NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (equipment_id) REFERENCES equipment(id),
 INDEX (equipment_id)
) ENGINE=InnoDB;
