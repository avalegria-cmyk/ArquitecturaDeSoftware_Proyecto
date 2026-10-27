<?php
declare(strict_types=1);
namespace App\Domain\Reservations;
use DateTimeImmutable;
use InvalidArgumentException;
final readonly class TimeSlot {
    public function __construct(public DateTimeImmutable $start, public DateTimeImmutable $end) {
        if ($start >= $end) { throw new InvalidArgumentException('La fecha de fin debe ser posterior al inicio.'); }
    }
    // Intervalos semiabiertos: devolver a las 10 permite una reserva desde las 10.
    public function overlaps(self $other): bool { return $this->start < $other->end && $this->end > $other->start; }
}
