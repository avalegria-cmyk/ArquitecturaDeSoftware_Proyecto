<?php
declare(strict_types=1);
namespace App\Infrastructure\Persistence;
use App\Application\Ports\EquipmentReportRepository;
use PDO;
final readonly class PdoEquipmentReportRepository implements EquipmentReportRepository
{
    public function __construct(private PDO $db) {}
    public function snapshot(?int $equipmentId): array
    {
        $this->db->beginTransaction();
        try {
            $where = $equipmentId === null ? '' : ' WHERE e.id = ?';
            $params = $equipmentId === null ? [] : [$equipmentId];
            $query=$this->db->prepare('SELECT e.*,
                (SELECT COUNT(*) FROM loans l WHERE l.equipment_id=e.id) AS totalLoans,
                (SELECT COUNT(*) FROM loans l WHERE l.equipment_id=e.id AND l.returned_at IS NULL) AS activeLoans,
                (SELECT COUNT(*) FROM maintenance_reviews m WHERE m.equipment_id=e.id) AS totalReviews
                FROM equipment e'.$where.' ORDER BY e.code');
            $query->execute($params); $equipment=$query->fetchAll();
            if ($equipmentId !== null && !$equipment) { throw new \InvalidArgumentException('El equipo no existe.'); }
            foreach ($equipment as &$item) { foreach (['id','totalLoans','activeLoans','totalReviews'] as $key) { $item[$key]=(int)$item[$key]; } } unset($item);
            $query=$this->db->prepare('SELECT l.id, e.id AS equipmentId, e.code, e.name, r.id AS reservationId,
                u.name AS requester, u.email, t.name AS teacher, r.purpose,
                r.starts_at AS reservedStart, r.ends_at AS reservedEnd, l.started_at AS startedAt, l.returned_at AS returnedAt,
                CASE WHEN l.returned_at IS NOT NULL THEN "Devuelto" WHEN r.ends_at < UTC_TIMESTAMP() THEN "En uso · atrasado" ELSE "En uso" END AS state
                FROM loans l JOIN equipment e ON e.id=l.equipment_id JOIN reservations r ON r.id=l.reservation_id
                JOIN users u ON u.id=r.requester_id JOIN users t ON t.id=r.teacher_id'.$where.' ORDER BY l.started_at DESC,l.id DESC');
            $query->execute($params); $loans=$query->fetchAll();
            foreach ($loans as &$loan) {
                foreach (['reservedStart','reservedEnd','startedAt','returnedAt'] as $key) { $loan[$key]=$loan[$key] ? str_replace(' ', 'T', $loan[$key]).'Z' : null; }
                $loan['startPhotoUrl']='/api/loans/'.$loan['reservationId'].'/photos/inicio';
                $loan['returnPhotoUrl']=$loan['returnedAt'] ? '/api/loans/'.$loan['reservationId'].'/photos/devolucion' : null;
            } unset($loan);
            $query=$this->db->prepare('SELECT m.id, e.id AS equipmentId, e.code, e.name, m.comments, u.name AS reviewer, m.reviewed_at AS reviewedAt
                FROM maintenance_reviews m JOIN equipment e ON e.id=m.equipment_id JOIN users u ON u.id=m.reviewer_id'.$where.' ORDER BY m.reviewed_at DESC,m.id DESC');
            $query->execute($params); $reviews=$query->fetchAll();
            foreach ($reviews as &$review) { $review['reviewedAt']=str_replace(' ', 'T', $review['reviewedAt']).'Z'; $review['photoUrl']='/api/maintenance/reviews/'.$review['id'].'/photo'; } unset($review);
            $this->db->commit();
            return ['equipment'=>$equipment,'loans'=>$loans,'reviews'=>$reviews,'generatedAt'=>gmdate('Y-m-d\TH:i:s\Z')];
        } catch (\Throwable $error) { if ($this->db->inTransaction()) $this->db->rollBack(); throw $error; }
    }
}
