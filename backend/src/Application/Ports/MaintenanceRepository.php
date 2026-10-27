<?php
declare(strict_types=1);
namespace App\Application\Ports;
use App\Domain\Equipment\MaintenanceReview;
use App\Domain\Loans\EvidencePhoto;
use App\Domain\Identity\User;
use DateTimeImmutable;
interface MaintenanceRepository {
    public function pending(): array;
    public function complete(MaintenanceReview $review, EvidencePhoto $photo, User $actor, DateTimeImmutable $now): void;
    public function history(): array;
    public function photo(int $id): ?string;
}
