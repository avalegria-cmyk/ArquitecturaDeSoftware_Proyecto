-- Una solicitud por unidad física. Todas las fechas se almacenan en UTC.
CREATE TABLE IF NOT EXISTS reservations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    requester_id BIGINT UNSIGNED NOT NULL,
    equipment_id BIGINT UNSIGNED NOT NULL,
    teacher_id BIGINT UNSIGNED NOT NULL,
    starts_at DATETIME NOT NULL,
    ends_at DATETIME NOT NULL,
    purpose VARCHAR(1000) NOT NULL,
    status ENUM('en_revision', 'aceptado', 'rechazado') NOT NULL DEFAULT 'en_revision',
    request_key CHAR(36) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_request_retry (requester_id, request_key),
    INDEX idx_equipment_interval (equipment_id, status, starts_at, ends_at),
    INDEX idx_requester_history (requester_id, created_at),
    FOREIGN KEY (requester_id) REFERENCES users(id),
    FOREIGN KEY (equipment_id) REFERENCES equipment(id),
    FOREIGN KEY (teacher_id) REFERENCES users(id),
    CONSTRAINT chk_reservation_interval CHECK (starts_at < ends_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reservation_events (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reservation_id BIGINT UNSIGNED NOT NULL,
    step ENUM('enviado', 'docente', 'jefe_laboratorio', 'encargado_laboratorio') NOT NULL,
    outcome ENUM('completado', 'rechazado') NOT NULL,
    actor_id BIGINT UNSIGNED NOT NULL,
    note VARCHAR(1000) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_reservation_step (reservation_id, step),
    FOREIGN KEY (reservation_id) REFERENCES reservations(id),
    FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB;
