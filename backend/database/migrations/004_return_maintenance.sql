-- Adaptación inicial de unidades devueltas antes de esta funcionalidad.
-- No toca unidades prestadas, fuera de servicio o con un préstamo activo.
START TRANSACTION;
CREATE TEMPORARY TABLE returned_units (id BIGINT UNSIGNED PRIMARY KEY);
INSERT INTO returned_units
SELECT e.id FROM equipment e
WHERE e.status = 'disponible'
AND EXISTS (SELECT 1 FROM loans l WHERE l.equipment_id=e.id AND l.returned_at IS NOT NULL)
AND NOT EXISTS (SELECT 1 FROM loans l WHERE l.equipment_id=e.id AND l.returned_at IS NULL)
FOR UPDATE;
INSERT INTO audit_logs (user_id, action)
SELECT r.requester_id, CONCAT('equipment.maintenance.backfill:', e.id)
FROM returned_units e JOIN loans l ON l.equipment_id=e.id
JOIN reservations r ON r.id=l.reservation_id
WHERE NOT EXISTS (SELECT 1 FROM loans newer WHERE newer.equipment_id=e.id AND newer.id>l.id);
UPDATE equipment e JOIN returned_units m ON m.id=e.id SET e.status='mantenimiento';
DROP TEMPORARY TABLE returned_units;
COMMIT;
