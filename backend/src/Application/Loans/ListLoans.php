<?php
declare(strict_types=1);
namespace App\Application\Loans;
use App\Application\Ports\LoanRepository;
use App\Domain\Identity\User;
use App\Domain\Reservations\ReservationWorkflow;
final readonly class ListLoans
{
    public function __construct(private LoanRepository $loans) {}
    public function execute(User $actor): array
    {
        return array_map(static function (array $row): array {
            $row['timeline'] = ReservationWorkflow::timeline($row['events']);
            unset($row['events']);
            return $row;
        }, $this->loans->loanHistory($actor));
    }
}
