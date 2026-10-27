<?php
declare(strict_types=1);
namespace App\Infrastructure\Persistence;
use App\Application\Ports\MaintenanceRepository;
use PDO;
use App\Domain\Equipment\MaintenanceReview;
use App\Domain\Loans\EvidencePhoto;
use App\Domain\Identity\User;
use DateTimeImmutable;
use DateTimeZone;
final readonly class PdoMaintenanceRepository implements MaintenanceRepository
{
    public function __construct(private PDO $db) {}
    public function pending(): array
    {
        $rows = $this->db->query("SELECT e.*, l.id AS loan_id, l.reservation_id, l.started_at, l.returned_at,
            u.name AS requester_name FROM equipment e
            LEFT JOIN loans l ON l.equipment_id = e.id AND l.returned_at IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM loans newer WHERE newer.equipment_id=e.id AND newer.id>l.id)
            LEFT JOIN reservations r ON r.id=l.reservation_id LEFT JOIN users u ON u.id=r.requester_id
            WHERE e.status = 'mantenimiento' ORDER BY l.returned_at DESC, e.code")->fetchAll();
        return array_map(static fn(array $row): array => [
            'loanId'=>$row['loan_id'] ? (int)$row['loan_id'] : null, 'id'=>(int)$row['id'], 'code'=>$row['code'], 'name'=>$row['name'], 'category'=>$row['category'],
            'location'=>$row['location'], 'description'=>$row['description'],
            'requester'=>$row['requester_name'], 'reservationId'=>$row['reservation_id'] ? (int)$row['reservation_id'] : null,
            'loan'=>$row['loan_id'] ? [
                'startedAt'=>str_replace(' ', 'T', $row['started_at']).'Z',
                'returnedAt'=>str_replace(' ', 'T', $row['returned_at']).'Z',
                'startPhotoUrl'=>'/api/loans/'.$row['reservation_id'].'/photos/inicio',
                'returnPhotoUrl'=>'/api/loans/'.$row['reservation_id'].'/photos/devolucion',
            ] : null,
        ], $rows);
    }

    public function complete(MaintenanceReview $review, EvidencePhoto $photo, User $actor, DateTimeImmutable $now): void
    {
        $this->db->beginTransaction();
        try {
            $query = $this->db->prepare('SELECT status FROM equipment WHERE id=? FOR UPDATE');
            $query->execute([$review->equipmentId]);
            $status = $query->fetchColumn();
            if ($status === false) { throw new \InvalidArgumentException('El equipo no existe.'); }
            $query = $this->db->prepare('SELECT id, returned_at FROM loans WHERE equipment_id=? ORDER BY id DESC LIMIT 1 FOR UPDATE');
            $query->execute([$review->equipmentId]);
            $loan = $query->fetch();
            $review->assertCurrent($status, $loan ? (int)$loan['id'] : null, $loan && $loan['returned_at'] === null);
            $query = $this->db->prepare('INSERT INTO maintenance_reviews (equipment_id, loan_id, reviewer_id, comments, photo, reviewed_at) VALUES (?, ?, ?, ?, ?, ?)');
            $query->bindValue(1, $review->equipmentId, PDO::PARAM_INT);
            $query->bindValue(2, $review->loanId, $review->loanId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $query->bindValue(3, $actor->id, PDO::PARAM_INT);
            $query->bindValue(4, $review->comments);
            $query->bindValue(5, $photo->bytes, PDO::PARAM_LOB);
            $query->bindValue(6, $now->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s'));
            $query->execute();
            $id = $this->db->lastInsertId();
            $this->db->prepare("UPDATE equipment SET status='disponible' WHERE id=?")->execute([$review->equipmentId]);
            $this->db->prepare('INSERT INTO audit_logs (user_id, action) VALUES (?, ?)')->execute([$actor->id, 'equipment.maintenance.completed:'.$id]);
            $this->db->commit();
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) { $this->db->rollBack(); }
            throw $error;
        }
    }
    public function history(): array
    {
        return $this->db->query("SELECT m.id, e.code, e.name, m.comments, u.name AS reviewer,
            CONCAT(DATE_FORMAT(m.reviewed_at, '%Y-%m-%dT%H:%i:%s'), 'Z') AS reviewedAt,
            CONCAT('/api/maintenance/reviews/', m.id, '/photo') AS photoUrl
            FROM maintenance_reviews m JOIN equipment e ON e.id=m.equipment_id
            JOIN users u ON u.id=m.reviewer_id ORDER BY m.reviewed_at DESC, m.id DESC")->fetchAll();
    }
    public function photo(int $id): ?string
    {
        $query=$this->db->prepare('SELECT photo FROM maintenance_reviews WHERE id=?');
        $query->execute([$id]);
        $photo=$query->fetchColumn();
        return $photo === false ? null : $photo;
    }
}
