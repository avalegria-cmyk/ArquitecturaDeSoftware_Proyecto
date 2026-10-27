<?php
declare(strict_types=1);
namespace App\Adapters\Http\Controllers;
use App\Application\Loans\{RecordLoan, ListLoans, ViewLoanPhoto};
use App\Application\Ports\Clock;
use App\Domain\Identity\User;
use App\Adapters\Http\{Input, Response};
use InvalidArgumentException;
final readonly class LoanController
{
    public function __construct(private RecordLoan $record, private ListLoans $list, private ViewLoanPhoto $photo, private Clock $clock) {}
    public function index(User $actor): never
    {
        Response::json(['reservations'=>$this->list->execute($actor), 'serverNow'=>$this->clock->now()->format(DATE_ATOM)]);
    }
    public function store(User $actor, array $input, string $phase): never
    {
        if (($input['completeDeviceConfirmed'] ?? false) !== true) { throw new InvalidArgumentException('Confirma que se ve el equipo completo y su código en la foto.'); }
        $encoded = Input::text($input, 'photo');
        if (strlen($encoded) > 5592408) { throw new InvalidArgumentException('La foto supera el tamaño permitido.'); }
        $bytes = base64_decode($encoded, true);
        if ($bytes === false) { throw new InvalidArgumentException('La foto recibida no es válida.'); }
        Response::json(['loan'=>$this->record->execute($actor, Input::id($input, 'reservationId'), $phase, $bytes)]);
    }
    public function photo(User $actor, int $id, string $phase): never
    {
        $bytes = $this->photo->execute($actor, $id, $phase);
        header('Content-Type: image/jpeg'); header('Content-Length: '.strlen($bytes));
        header('Cache-Control: private, no-store'); header('X-Content-Type-Options: nosniff');
        header('Content-Disposition: inline; filename="equipo-'.$id.'-'.$phase.'.jpg"');
        echo $bytes; exit;
    }
}
