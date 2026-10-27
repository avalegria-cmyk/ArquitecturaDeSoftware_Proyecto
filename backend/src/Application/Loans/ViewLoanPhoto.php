<?php
declare(strict_types=1);
namespace App\Application\Loans;
use App\Application\Ports\LoanRepository;
use App\Application\Exceptions\Forbidden;
use App\Domain\Identity\User;
use App\Domain\Loans\LoanPolicy;
final readonly class ViewLoanPhoto
{
    public function __construct(private LoanRepository $loans) {}
    public function execute(User $actor, int $id, string $phase): string
    {
        $record = $this->loans->loanPhoto($id, $phase);
        if (!$record || !LoanPolicy::canSeeEvidence($actor, $record)) {
            throw new Forbidden('No tienes acceso a esta evidencia.');
        }
        return $record['content'];
    }
}
