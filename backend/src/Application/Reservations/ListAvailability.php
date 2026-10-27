<?php
declare(strict_types=1);
namespace App\Application\Reservations;
use App\Application\Ports\{ReservationRepository, Clock};
use App\Domain\Reservations\TimeSlot;
final readonly class ListAvailability
{
    public function __construct(private ReservationRepository $reservations, private Clock $clock) {}
    public function execute(?TimeSlot $slot): array
    {
        if ($slot && $slot->start <= $this->clock->now()) {
            throw new \InvalidArgumentException('Selecciona una fecha y hora de inicio futuras.');
        }
        return $this->reservations->available($slot);
    }
}
