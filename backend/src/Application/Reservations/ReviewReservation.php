<?php
declare(strict_types=1);
namespace App\Application\Reservations;
use App\Application\Ports\{ReservationReviewRepository, Clock};
use App\Application\Exceptions\Conflict;
use App\Domain\Identity\User;
use App\Domain\Reservations\{ApprovalPolicy, ApprovalDecision};
use DateTimeImmutable;
use DomainException;
final readonly class ReviewReservation
{
    public function __construct(private ReservationReviewRepository $reservations, private Clock $clock) {}
    public function execute(User $actor, int $id, ApprovalDecision $decision): array
    {
        if (ApprovalPolicy::stageFor($actor) !== $decision->step) {
            throw new DomainException('No puedes decidir una fase asignada a otro rol.');
        }
        return $this->reservations->transaction(function () use ($actor, $id, $decision): array {
            $reservation = $this->reservations->lockForReview($id);
            if (!$reservation) { throw new Conflict('La solicitud ya no está disponible. Actualiza la bandeja.'); }
            ApprovalPolicy::assertAssigned($actor, $reservation, $decision->step);
            if (ApprovalPolicy::pendingStage($reservation) !== $decision->step) {
                throw new Conflict('La solicitud ya fue atendida o todavía no llegó a tu fase. Actualiza la bandeja.');
            }
            if ($decision->outcome === 'completado') {
                if ($reservation['equipmentStatus'] !== 'disponible') {
                    throw new Conflict('El equipo ya no está habilitado para préstamo. Puedes rechazar la solicitud indicando el motivo.');
                }
                if (new DateTimeImmutable($reservation['endsAt']) <= $this->clock->now()) {
                    throw new Conflict('El período solicitado ya terminó. Puedes rechazar la solicitud indicando el motivo.');
                }
            }
            $status = ApprovalPolicy::resultingStatus($decision);
            $this->reservations->recordDecision($id, $actor->id, $decision, $status);
            return ['id'=>$id, 'status'=>$status, 'step'=>$decision->step];
        });
    }
}
