<?php
declare(strict_types=1);
namespace App\Application\Reservations;
use App\Application\Ports\ReservationRepository;
final readonly class ListResponsibleTeachers
{
    public function __construct(private ReservationRepository $reservations) {}
    public function execute(): array { return $this->reservations->teachers(); }
}
