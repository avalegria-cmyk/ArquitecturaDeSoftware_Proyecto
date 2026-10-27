<?php
declare(strict_types=1);
namespace App\Application\Ports;
use App\Domain\Identity\User;
use App\Domain\Reservations\ApprovalDecision;
interface ReservationReviewRepository
{
    public function transaction(callable $operation): mixed;
    /** Reservas asignadas al docente o que ya alcanzaron la fase del personal. */
    public function reviewHistory(User $actor): array;
    /** Bloquea primero el equipo y luego la reserva; devuelve eventos actuales. */
    public function lockForReview(int $id): ?array;
    public function recordDecision(int $id, int $actorId, ApprovalDecision $decision, string $status): void;
}
