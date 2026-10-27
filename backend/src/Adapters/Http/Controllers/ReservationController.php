<?php
declare(strict_types=1);
namespace App\Adapters\Http\Controllers;
use App\Application\Reservations\{CreateReservation, ListAvailability, ListMyReservations, ListResponsibleTeachers};
use App\Adapters\Http\{Response, Input};
use App\Domain\Identity\User;
use App\Application\Ports\Clock;
use App\Domain\Reservations\ReservationRequest;
final readonly class ReservationController
{
    public function __construct(
        private CreateReservation $create,
        private ListAvailability $availability,
        private ListMyReservations $history,
        private ListResponsibleTeachers $teachers,
        private Clock $clock
    ) {}
    public function index(User $actor): never { Response::json(['reservations'=>$this->history->execute($actor), 'serverNow'=>$this->clock->now()->format(DATE_ATOM)]); }
    public function teachers(): never { Response::json(['teachers'=>$this->teachers->execute()]); }
    public function availability(array $query): never
    {
        $slot = (isset($query['startsAt']) || isset($query['endsAt'])) ? Input::slot($query) : null;
        Response::json(['equipment'=>$this->availability->execute($slot), 'intervalChecked'=>$slot !== null]);
    }
    public function store(User $actor, array $input): never
    {
        $request = new ReservationRequest(Input::id($input, 'equipmentId'), Input::id($input, 'teacherId'),
            Input::slot($input), Input::text($input, 'purpose'), Input::text($input, 'requestKey'));
        Response::json(['reservation'=>$this->create->execute($actor, $request),
            'message'=>'Reserva enviada. Está en revisión, pendiente del docente responsable.'], 201);
    }
}
