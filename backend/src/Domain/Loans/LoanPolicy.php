<?php
declare(strict_types=1);
namespace App\Domain\Loans;
use App\Domain\Identity\{User, Role};
use DateTimeImmutable;
use DomainException;
final class LoanPolicy
{
    public static function isAdminTest(User $actor): bool
    {
        return $actor->active && $actor->role === Role::ADMIN;
    }
    public static function assertOwner(User $actor, array $reservation): void
    {
        if (self::isAdminTest($actor)) { return; }
        if (!$actor->active || !in_array($actor->role, [Role::STUDENT, Role::TEACHER], true)
            || $reservation['requester']['id'] !== $actor->id) {
            throw new DomainException('Solo quien solicitó el equipo puede iniciar su uso o devolverlo.');
        }
    }
    public static function startProblem(array $reservation, DateTimeImmutable $now, bool $adminTest = false): ?string
    {
        if ($reservation['status'] !== 'aceptado') { return 'Debes completar las tres aprobaciones antes de usar el equipo.'; }
        if ($reservation['loan']) { return 'Esta reserva ya tiene un préstamo registrado.'; }
        if (!$adminTest && $now < new DateTimeImmutable($reservation['startsAt'])) { return 'Todavía no llega la fecha y hora de inicio de tu reserva.'; }
        if (!$adminTest && $now >= new DateTimeImmutable($reservation['endsAt'])) { return 'El período reservado ya terminó. Realiza una nueva reserva.'; }
        if ($reservation['equipmentStatus'] !== 'disponible') { return 'Esta unidad todavía no está disponible. Puede seguir en uso o estar en mantenimiento.'; }
        return null;
    }
    public static function canSeeEvidence(User $actor, array $record): bool
    {
        return $actor->active && ($actor->role->canManageEquipment()
            || $actor->id === $record['requesterId']
            || ($actor->role === Role::TEACHER && $actor->id === $record['teacherId']));
    }
}
