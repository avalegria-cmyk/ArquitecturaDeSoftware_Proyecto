<?php
declare(strict_types=1);
namespace App\Domain\Reservations;
use App\Domain\Identity\{User, Role};
use DateTimeImmutable;
use InvalidArgumentException;
final readonly class ReservationRequest
{
    public function __construct(
        public int $equipmentId,
        public int $teacherId,
        public TimeSlot $slot,
        public string $purpose,
        public string $requestKey
    ) {
        if ($equipmentId < 1 || $teacherId < 1) {
            throw new InvalidArgumentException('Selecciona un equipo y un docente responsable.');
        }
        if (trim($purpose) === '' || mb_strlen($purpose) > 1000) {
            throw new InvalidArgumentException('Indica el motivo de la reserva, con un máximo de 1000 caracteres.');
        }
        if (!preg_match('/^[a-f0-9-]{36}$/D', $requestKey)) {
            throw new InvalidArgumentException('Identificador de solicitud inválido. Vuelve a abrir el formulario.');
        }
    }

    public function assertFuture(DateTimeImmutable $now): void
    {
        if ($this->slot->start <= $now) {
            throw new InvalidArgumentException('La fecha y hora de inicio deben ser posteriores al momento actual.');
        }
    }

    public function assertTeacher(?User $teacher): void
    {
        if (!$teacher || !$teacher->active || $teacher->role !== Role::TEACHER) {
            throw new InvalidArgumentException('Selecciona un docente responsable activo.');
        }
    }
}
