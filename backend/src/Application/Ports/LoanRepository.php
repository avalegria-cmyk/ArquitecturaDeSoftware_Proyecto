<?php
declare(strict_types=1);
namespace App\Application\Ports;
use App\Domain\Identity\User;
use App\Domain\Loans\EvidencePhoto;
use DateTimeImmutable;
interface LoanRepository
{
    public function transaction(callable $operation): mixed;
    public function lockForReview(int $id): ?array;
    public function loanHistory(User $actor): array;
    public function startLoan(array $reservation, EvidencePhoto $photo, DateTimeImmutable $now, User $actor): void;
    public function returnLoan(array $reservation, EvidencePhoto $photo, DateTimeImmutable $now, User $actor): void;
    public function loanPhoto(int $reservationId, string $phase): ?array;
}
