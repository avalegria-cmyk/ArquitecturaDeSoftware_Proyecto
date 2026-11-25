-- Base privada del servicio de Reservas (reservas_db en PostgreSQL).
-- Los usuarios y equipos viven en otros servicios: aquí solo se guarda su id
-- y una copia de los datos que se muestran (nombre, correo, código...).
CREATE TABLE IF NOT EXISTS reservations (
  id BIGSERIAL PRIMARY KEY,
  requester_id BIGINT NOT NULL,
  requester_name VARCHAR(120) NOT NULL,
  requester_email VARCHAR(190) NOT NULL,
  teacher_id BIGINT NOT NULL,
  teacher_name VARCHAR(120) NOT NULL,
  teacher_email VARCHAR(190) NOT NULL,
  equipment_id BIGINT NOT NULL,
  equipment_code VARCHAR(30) NOT NULL,
  equipment_name VARCHAR(120) NOT NULL,
  equipment_category VARCHAR(60) NOT NULL,
  equipment_location VARCHAR(120) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  purpose VARCHAR(1000) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'en_revision' CHECK (status IN ('en_revision', 'aceptado', 'rechazado')),
  request_key CHAR(36) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Copia del préstamo: la actualiza el servicio de Préstamos.
  loan_id BIGINT,
  loan_started_at TIMESTAMPTZ,
  loan_returned_at TIMESTAMPTZ,
  CONSTRAINT uq_request_retry UNIQUE (requester_id, request_key),
  CONSTRAINT chk_reservation_interval CHECK (starts_at < ends_at)
);
CREATE INDEX IF NOT EXISTS idx_equipment_interval ON reservations (equipment_id, status, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_requester_history ON reservations (requester_id, created_at);
CREATE INDEX IF NOT EXISTS idx_teacher ON reservations (teacher_id);

CREATE TABLE IF NOT EXISTS reservation_events (
  id BIGSERIAL PRIMARY KEY,
  reservation_id BIGINT NOT NULL REFERENCES reservations (id),
  step VARCHAR(30) NOT NULL CHECK (step IN ('enviado', 'docente', 'jefe_laboratorio', 'encargado_laboratorio')),
  outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('completado', 'rechazado')),
  actor_id BIGINT NOT NULL,
  actor_name VARCHAR(120) NOT NULL,
  note VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_reservation_step UNIQUE (reservation_id, step)
);
