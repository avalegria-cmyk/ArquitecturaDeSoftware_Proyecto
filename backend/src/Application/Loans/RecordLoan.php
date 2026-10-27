<?php
declare(strict_types=1);
namespace App\Application\Loans;
use App\Application\Ports\{LoanRepository, PhotoProcessor, Clock};
use App\Application\Exceptions\Conflict;
use App\Domain\Identity\User;
use App\Domain\Loans\LoanPolicy;
use InvalidArgumentException;
final readonly class RecordLoan
{
    public function __construct(private LoanRepository $loans, private PhotoProcessor $photos, private Clock $clock) {}
    public function execute(User $actor, int $reservationId, string $phase, string $bytes): array
    {
        if (!in_array($phase, ['inicio', 'devolucion'], true)) { throw new InvalidArgumentException('Operación de préstamo no válida.'); }
        $photo = $this->photos->prepare($bytes);
        return $this->loans->transaction(function () use ($actor, $reservationId, $phase, $photo): array {
            $reservation = $this->loans->lockForReview($reservationId);
            if (!$reservation) { throw new Conflict('La reserva ya no está disponible.'); }
            LoanPolicy::assertOwner($actor, $reservation);
            $loan = $reservation['loan'];
            $now = $this->clock->now();
            if ($phase === 'inicio') {
                // Reintentos tras perder la respuesta conservan el préstamo y su evidencia inicial.
                if ($loan && !$loan['returnedAt']) { return ['reservationId'=>$reservationId, 'state'=>'en_uso']; }
                $problem = LoanPolicy::startProblem($reservation, $now, LoanPolicy::isAdminTest($actor));
                if ($problem) { throw new Conflict($problem); }
                $this->loans->startLoan($reservation, $photo, $now, $actor);
                return ['reservationId'=>$reservationId, 'state'=>'en_uso'];
            }
            if (!$loan) { throw new Conflict('Primero debes registrar el inicio de uso.'); }
            if ($loan['returnedAt']) { return ['reservationId'=>$reservationId, 'state'=>'devuelto']; }
            // No exige esperar al fin; tampoco impide devolver después de la hora prevista.
            $this->loans->returnLoan($reservation, $photo, $now, $actor);
            return ['reservationId'=>$reservationId, 'state'=>'devuelto'];
        });
    }
}
