<?php
declare(strict_types=1);
namespace App\Infrastructure\Persistence;
use App\Application\Ports\{ReservationRepository, ReservationReviewRepository, LoanRepository};
use App\Domain\Identity\User;
use App\Domain\Loans\EvidencePhoto;
use App\Domain\Reservations\{ApprovalPolicy, ApprovalDecision};
use App\Application\Exceptions\Conflict;
use App\Domain\Equipment\Equipment;
use App\Domain\Reservations\{TimeSlot, ReservationRequest, ReservationWorkflow};
use PDO;
use PDOException;
use DateTimeImmutable;
use DateTimeZone;
use Throwable;
final readonly class PdoReservationRepository implements ReservationRepository, ReservationReviewRepository, LoanRepository
{
    public function __construct(private PDO $db) {}

    public function transaction(callable $operation): mixed
    {
        $this->db->beginTransaction();
        try {
            $result = $operation();
            $this->db->commit();
            return $result;
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) { $this->db->rollBack(); }
            if ($error instanceof PDOException && in_array((int)($error->errorInfo[1] ?? 0), [1062, 1205, 1213], true)) {
                throw new Conflict('Otra solicitud se procesó al mismo tiempo. Actualiza la disponibilidad y vuelve a intentarlo.');
            }
            throw $error;
        }
    }

    public function lockEquipment(int $equipmentId): ?Equipment
    {
        $query = $this->db->prepare('SELECT * FROM equipment WHERE id = ? FOR UPDATE');
        $query->execute([$equipmentId]);
        $row = $query->fetch();
        return $row ? $this->equipment($row) : null;
    }

    private function equipment(array $row): Equipment
    {
        return new Equipment((int)$row['id'], $row['code'], $row['name'], $row['category'], $row['status'], $row['location'], $row['description']);
    }

    private function date(DateTimeImmutable $value): string
    {
        return $value->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }

    public function blockingSlots(int $equipmentId, TimeSlot $slot): array
    {
        $query = $this->db->prepare('SELECT starts_at, ends_at FROM reservations
            WHERE equipment_id = ? AND status IN (?, ?) AND starts_at < ? AND ends_at > ?
            AND NOT EXISTS (SELECT 1 FROM loans l WHERE l.reservation_id = reservations.id AND l.returned_at IS NOT NULL) FOR UPDATE');
        $query->execute([$equipmentId, ...ReservationWorkflow::BLOCKING_STATUSES, $this->date($slot->end), $this->date($slot->start)]);
        return array_map(static fn(array $row): TimeSlot => new TimeSlot(
            new DateTimeImmutable($row['starts_at'], new DateTimeZone('UTC')),
            new DateTimeImmutable($row['ends_at'], new DateTimeZone('UTC'))
        ), $query->fetchAll());
    }

    public function available(?TimeSlot $slot): array
    {
        $sql = "SELECT e.* FROM equipment e WHERE e.status = 'disponible'";
        $parameters = [];
        if ($slot) {
            $sql .= ' AND NOT EXISTS (SELECT 1 FROM reservations r WHERE r.equipment_id = e.id
                AND r.status IN (?, ?) AND r.starts_at < ? AND r.ends_at > ?
                AND NOT EXISTS (SELECT 1 FROM loans l WHERE l.reservation_id = r.id AND l.returned_at IS NOT NULL))';
            $parameters = [...ReservationWorkflow::BLOCKING_STATUSES, $this->date($slot->end), $this->date($slot->start)];
        }
        $query = $this->db->prepare($sql.' ORDER BY e.category, e.name, e.code');
        $query->execute($parameters);
        return array_map(fn(array $row): array => $this->equipment($row)->toArray(), $query->fetchAll());
    }

    public function teachers(): array
    {
        return $this->db->query("SELECT id, name FROM users WHERE active = 1 AND role = 'docente' ORDER BY name")->fetchAll();
    }

    public function findByRequestKey(int $requesterId, string $requestKey): ?array
    {
        $query = $this->db->prepare('SELECT id, status FROM reservations WHERE requester_id = ? AND request_key = ? FOR UPDATE');
        $query->execute([$requesterId, $requestKey]);
        $row = $query->fetch();
        return $row ? ['id'=>(int)$row['id'], 'status'=>$row['status']] : null;
    }

    public function create(int $requesterId, ReservationRequest $request): array
    {
        $query = $this->db->prepare('INSERT INTO reservations
            (requester_id, equipment_id, teacher_id, starts_at, ends_at, purpose, request_key, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $query->execute([$requesterId, $request->equipmentId, $request->teacherId,
            $this->date($request->slot->start), $this->date($request->slot->end),
            $request->purpose, $request->requestKey, ReservationWorkflow::INITIAL_STATUS]);
        $id = (int)$this->db->lastInsertId();
        $this->db->prepare("INSERT INTO reservation_events (reservation_id, step, outcome, actor_id)
            VALUES (?, 'enviado', 'completado', ?)")->execute([$id, $requesterId]);
        $this->db->prepare('INSERT INTO audit_logs (user_id, action) VALUES (?, ?)')->execute([$requesterId, 'reservation.submitted:'.$id]);
        return ['id'=>$id, 'status'=>ReservationWorkflow::INITIAL_STATUS];
    }

    public function historyFor(int $requesterId): array
    {
        return $this->readHistory('r.requester_id = ?', [$requesterId]);
    }

    public function reviewHistory(User $actor): array
    {
        $stage = ApprovalPolicy::stageFor($actor);
        if ($stage === 'docente') { return $this->readHistory('r.teacher_id = ?', [$actor->id]); }
        $previous = $stage === 'jefe_laboratorio' ? 'docente' : 'jefe_laboratorio';
        return $this->readHistory("EXISTS (SELECT 1 FROM reservation_events prior
            WHERE prior.reservation_id = r.id AND prior.step = ? AND prior.outcome = 'completado')", [$previous]);
    }

    public function lockForReview(int $id): ?array
    {
        $query = $this->db->prepare('SELECT equipment_id FROM reservations WHERE id = ?');
        $query->execute([$id]);
        $equipmentId = $query->fetchColumn();
        if (!$equipmentId) { return null; }
        // Igual orden de bloqueo que CreateReservation para serializar disponibilidad.
        $equipment = $this->lockEquipment((int)$equipmentId);
        $query = $this->db->prepare('SELECT id FROM reservations WHERE id = ? FOR UPDATE');
        $query->execute([$id]);
        if (!$query->fetchColumn()) { return null; }
        $row = $this->readHistory('r.id = ?', [$id], true)[0] ?? null;
        if ($row) { $row['equipmentStatus'] = $equipment?->status; }
        return $row;
    }

    public function recordDecision(int $id, int $actorId, ApprovalDecision $decision, string $status): void
    {
        $this->db->prepare('INSERT INTO reservation_events (reservation_id, step, outcome, actor_id, note)
            VALUES (?, ?, ?, ?, ?)')->execute([$id, $decision->step, $decision->outcome, $actorId, $decision->note !== '' ? $decision->note : null]);
        $this->db->prepare('UPDATE reservations SET status = ? WHERE id = ?')->execute([$status, $id]);
        $this->db->prepare('INSERT INTO audit_logs (user_id, action) VALUES (?, ?)')
            ->execute([$actorId, 'reservation.'.$decision->outcome.':'.$id.':'.$decision->step]);
    }

    public function loanHistory(User $actor): array
    {
        return $actor->role->canManageEquipment()
            ? $this->readHistory("r.status = 'aceptado'", [])
            : $this->readHistory("r.status = 'aceptado' AND r.requester_id = ?", [$actor->id]);
    }

    public function startLoan(array $reservation, EvidencePhoto $photo, DateTimeImmutable $now, User $actor): void
    {
        $this->db->prepare('INSERT INTO loans (reservation_id, equipment_id, started_at) VALUES (?, ?, ?)')
            ->execute([$reservation['id'], $reservation['equipment']['id'], $this->date($now)]);
        $id = (int)$this->db->lastInsertId();
        $this->savePhoto($id, 'inicio', $photo, $now);
        $this->db->prepare("UPDATE equipment SET status = 'prestado' WHERE id = ?")
            ->execute([$reservation['equipment']['id']]);
        $this->db->prepare('INSERT INTO audit_logs (user_id, action) VALUES (?, ?)')
            ->execute([$actor->id, ($actor->role === \App\Domain\Identity\Role::ADMIN ? 'loan.admin_test.started:' : 'loan.started:').$id]);
    }

    public function returnLoan(array $reservation, EvidencePhoto $photo, DateTimeImmutable $now, User $actor): void
    {
        $id = $reservation['loan']['id'];
        $this->savePhoto($id, 'devolucion', $photo, $now);
        $this->db->prepare('UPDATE loans SET returned_at = ? WHERE id = ?')->execute([$this->date($now), $id]);
        // La unidad devuelta requiere revisión antes de otro préstamo.
        $this->db->prepare('UPDATE equipment SET status = ? WHERE id = ?')
            ->execute([\App\Domain\Equipment\ReturnCondition::afterUse($reservation['equipmentStatus']), $reservation['equipment']['id']]);
        $this->db->prepare('INSERT INTO audit_logs (user_id, action) VALUES (?, ?)')
            ->execute([$actor->id, ($actor->role === \App\Domain\Identity\Role::ADMIN ? 'loan.admin_test.returned:' : 'loan.returned:').$id]);
    }

    private function savePhoto(int $loanId, string $phase, EvidencePhoto $photo, DateTimeImmutable $now): void
    {
        $query = $this->db->prepare('INSERT INTO loan_photos (loan_id, phase, content, width, height, byte_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $query->bindValue(1, $loanId, PDO::PARAM_INT);
        $query->bindValue(2, $phase);
        $query->bindValue(3, $photo->bytes, PDO::PARAM_LOB);
        $query->bindValue(4, $photo->width, PDO::PARAM_INT);
        $query->bindValue(5, $photo->height, PDO::PARAM_INT);
        $query->bindValue(6, strlen($photo->bytes), PDO::PARAM_INT);
        $query->bindValue(7, $this->date($now));
        $query->execute();
    }

    public function loanPhoto(int $reservationId, string $phase): ?array
    {
        $query = $this->db->prepare('SELECT p.content, r.requester_id, r.teacher_id FROM loan_photos p
            JOIN loans l ON l.id = p.loan_id JOIN reservations r ON r.id = l.reservation_id
            WHERE r.id = ? AND p.phase = ?');
        $query->execute([$reservationId, $phase]);
        $row = $query->fetch();
        return $row ? ['content'=>$row['content'], 'requesterId'=>(int)$row['requester_id'], 'teacherId'=>(int)$row['teacher_id']] : null;
    }

    private function readHistory(string $where, array $parameters, bool $lock = false): array
    {
        // Condiciones internas; ningún fragmento SQL procede de la entrada HTTP.
        $query = $this->db->prepare('SELECT r.*, u.name AS requester_name, u.email AS requester_email,
            t.name AS teacher_name, t.email AS teacher_email,
            e.name AS equipment_name, e.code AS equipment_code, e.category AS equipment_category,
            e.location AS equipment_location, e.status AS equipment_status,
            l.id AS loan_id, l.started_at AS loan_started_at, l.returned_at AS loan_returned_at
            FROM reservations r JOIN users u ON u.id = r.requester_id
            JOIN users t ON t.id = r.teacher_id JOIN equipment e ON e.id = r.equipment_id
            LEFT JOIN loans l ON l.reservation_id = r.id
            WHERE '.$where.' ORDER BY r.created_at DESC, r.id DESC'.($lock ? ' FOR UPDATE' : ''));
        $query->execute($parameters);
        $rows = $query->fetchAll();
        $eventsQuery = $this->db->prepare('SELECT ev.*, u.name AS actor_name FROM reservation_events ev
            JOIN reservations r ON r.id = ev.reservation_id JOIN users u ON u.id = ev.actor_id
            WHERE '.$where.' ORDER BY ev.created_at, ev.id'.($lock ? ' FOR UPDATE' : ''));
        $eventsQuery->execute($parameters);
        $events = [];
        foreach ($eventsQuery->fetchAll() as $event) {
            $events[$event['reservation_id']][] = [
                'step'=>$event['step'], 'outcome'=>$event['outcome'], 'actor'=>$event['actor_name'],
                'at'=>$this->iso($event['created_at']), 'note'=>$event['note'],
            ];
        }
        return array_map(fn(array $row): array => [
            'id'=>(int)$row['id'], 'reference'=>'RES-'.str_pad((string)$row['id'], 5, '0', STR_PAD_LEFT),
            'requester'=>['id'=>(int)$row['requester_id'], 'name'=>$row['requester_name'], 'email'=>$row['requester_email']],
            'teacher'=>['id'=>(int)$row['teacher_id'], 'name'=>$row['teacher_name'], 'email'=>$row['teacher_email']],
            'equipment'=>['id'=>(int)$row['equipment_id'], 'name'=>$row['equipment_name'], 'code'=>$row['equipment_code'],
                'category'=>$row['equipment_category'], 'location'=>$row['equipment_location']],
            'startsAt'=>$this->iso($row['starts_at']), 'endsAt'=>$this->iso($row['ends_at']),
            'createdAt'=>$this->iso($row['created_at']), 'purpose'=>$row['purpose'], 'status'=>$row['status'],
            'events'=>$events[$row['id']] ?? [],
            'equipmentStatus'=>$row['equipment_status'],
            'loan'=>$row['loan_id'] ? [
                'id'=>(int)$row['loan_id'], 'startedAt'=>$this->iso($row['loan_started_at']),
                'returnedAt'=>$row['loan_returned_at'] ? $this->iso($row['loan_returned_at']) : null,
                'startPhotoUrl'=>'/api/loans/'.$row['id'].'/photos/inicio',
                'returnPhotoUrl'=>$row['loan_returned_at'] ? '/api/loans/'.$row['id'].'/photos/devolucion' : null,
            ] : null,
        ], $rows);
    }

    private function iso(string $date): string
    {
        return (new DateTimeImmutable($date, new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s\Z');
    }
}
