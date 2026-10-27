<?php
declare(strict_types=1);
namespace App\Application\Reservations;
use App\Application\Ports\{ReservationRepository, UserRepository, Clock};
use App\Application\Exceptions\{Conflict, Forbidden};
use App\Domain\Identity\{User, Role};
use App\Domain\Reservations\{ReservationPolicy, ReservationRequest};
use DomainException;
final readonly class CreateReservation
{
    public function __construct(
        private ReservationRepository $reservations,
        private UserRepository $users,
        private Clock $clock,
        private ReservationPolicy $policy
    ) {}

    public function execute(User $actor, ReservationRequest $request): array
    {
        if (!$actor->active || !in_array($actor->role, [Role::STUDENT, Role::TEACHER], true)) {
            throw new Forbidden('Las reservas las realizan estudiantes y docentes desde su cuenta.');
        }
        return $this->reservations->transaction(function () use ($actor, $request): array {
            // Serializa las peticiones del equipo antes de consultar los intervalos.
            $equipment = $this->reservations->lockEquipment($request->equipmentId);
            if (!$equipment) { throw new \InvalidArgumentException('El equipo seleccionado no existe.'); }
            $existing = $this->reservations->findByRequestKey($actor->id, $request->requestKey);
            if ($existing) { return $existing; }
            $request->assertFuture($this->clock->now());
            $request->assertTeacher($this->users->findById($request->teacherId));
            try {
                $this->policy->assertAllowed($equipment, $request->slot,
                    $this->reservations->blockingSlots($equipment->id, $request->slot));
            } catch (DomainException $error) {
                throw new Conflict('El equipo ya no está disponible para ese horario. Actualiza la disponibilidad y selecciona otro equipo o intervalo.');
            }
            return $this->reservations->create($actor->id, $request);
        });
    }
}
