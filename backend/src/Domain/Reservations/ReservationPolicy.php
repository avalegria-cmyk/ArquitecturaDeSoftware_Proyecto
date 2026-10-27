<?php
declare(strict_types=1);
namespace App\Domain\Reservations;
use App\Domain\Equipment\Equipment;
use DomainException;
final class ReservationPolicy {
    /** @param TimeSlot[] $activeSlots */
    public function assertAllowed(Equipment $equipment, TimeSlot $requested, array $activeSlots): void {
        if (!$equipment->canBeLoaned()) { throw new DomainException('El equipo no está habilitado para reservas.'); }
        foreach ($activeSlots as $slot) {
            if ($requested->overlaps($slot)) { throw new DomainException('Existe una reserva activa en ese horario.'); }
        }
    }
}
