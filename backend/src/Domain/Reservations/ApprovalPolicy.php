<?php
declare(strict_types=1);
namespace App\Domain\Reservations;
use App\Domain\Identity\{Role, User};
use DomainException;
final class ApprovalPolicy
{
    // Mientras no exista un rol de jefe, el administrador atiende esa fase.
    public static function stageFor(User $actor): string
    {
        if (!$actor->active) { throw new DomainException('La cuenta no está activa.'); }
        return match ($actor->role) {
            Role::TEACHER => 'docente',
            Role::ADMIN => 'jefe_laboratorio',
            Role::MANAGER => 'encargado_laboratorio',
            default => throw new DomainException('No tienes acceso a las aprobaciones.'),
        };
    }

    public static function pendingStage(array $reservation): ?string
    {
        if ($reservation['status'] !== ReservationWorkflow::INITIAL_STATUS) { return null; }
        foreach (ReservationWorkflow::timeline($reservation['events']) as $step) {
            if ($step['current']) { return $step['key']; }
        }
        return null;
    }

    public static function assertAssigned(User $actor, array $reservation, string $step): void
    {
        if (self::stageFor($actor) !== $step
            || ($step === 'docente' && $reservation['teacher']['id'] !== $actor->id)) {
            throw new DomainException('Solo el responsable de esta fase puede registrar la decisión.');
        }
    }

    public static function resultingStatus(ApprovalDecision $decision): string
    {
        if ($decision->outcome === 'rechazado') { return 'rechazado'; }
        return $decision->step === 'encargado_laboratorio' ? 'aceptado' : 'en_revision';
    }
}
