CREATE TABLE IF NOT EXISTS maintenance_reviews (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 equipment_id BIGINT UNSIGNED NOT NULL,
 loan_id BIGINT UNSIGNED NULL,
 reviewer_id BIGINT UNSIGNED NOT NULL,
 comments VARCHAR(2000) NOT NULL,
 photo MEDIUMBLOB NOT NULL,
 reviewed_at DATETIME NOT NULL,
 FOREIGN KEY (equipment_id) REFERENCES equipment(id),
 FOREIGN KEY (loan_id) REFERENCES loans(id),
 FOREIGN KEY (reviewer_id) REFERENCES users(id),
 INDEX (equipment_id, reviewed_at)
) ENGINE=InnoDB;
