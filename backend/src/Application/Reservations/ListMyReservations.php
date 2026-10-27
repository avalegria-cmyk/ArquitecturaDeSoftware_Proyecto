<?php
declare(strict_types=1);
namespace App\Application\Reservations;
use App\Application\Ports\ReservationRepository;
use App\Domain\Identity\User;
use App\Domain\Reservations\ReservationWorkflow;
final readonly class ListMyReservations
{
    public function __construct(private ReservationRepository $reservations) {}
    public function execute(User $actor): array
    {
        return array_map(static function (array $reservation): array {
            $reservation['timeline'] = ReservationWorkflow::timeline($reservation['events']);
            unset($reservation['events']);
            return $reservation;
        }, $this->reservations->historyFor($actor->id));
    }
}
