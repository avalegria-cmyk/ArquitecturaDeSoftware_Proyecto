CREATE TABLE users (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(120) NOT NULL, email VARCHAR(190) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 role ENUM('administrador','encargado','estudiante','docente') NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE equipment (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, code VARCHAR(30) NOT NULL UNIQUE,
 name VARCHAR(120) NOT NULL, category VARCHAR(60) NOT NULL,
 status ENUM('disponible','prestado','mantenimiento','fuera_servicio') NOT NULL DEFAULT 'disponible',
 location VARCHAR(120) NOT NULL, description TEXT NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE auth_sessions (
 id CHAR(48) PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, expires_at DATETIME NOT NULL,
 FOREIGN KEY (user_id) REFERENCES users(id), INDEX(expires_at)
) ENGINE=InnoDB;
CREATE TABLE audit_logs (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
 action VARCHAR(100) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;
-- Las tablas de reservas, préstamos y mantenimiento se incorporarán en sus módulos.
