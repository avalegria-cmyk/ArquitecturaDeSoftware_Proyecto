<?php
declare(strict_types=1);
namespace App\Application\Maintenance;
use App\Application\Ports\{MaintenanceRepository, PhotoProcessor, Clock};
use App\Domain\Equipment\MaintenanceReview;
use App\Domain\Identity\User;
final readonly class CompleteMaintenance
{
    public function __construct(private MaintenanceRepository $repository, private PhotoProcessor $photos, private Clock $clock) {}
    public function execute(User $actor, MaintenanceReview $review, string $bytes): void
    {
        MaintenanceReview::authorize($actor);
        $photo = $this->photos->prepare($bytes);
        $this->repository->complete($review, $photo, $actor, $this->clock->now());
    }
    public function history(User $actor): array { MaintenanceReview::authorize($actor); return $this->repository->history(); }
    public function photo(User $actor, int $id): string
    {
        MaintenanceReview::authorize($actor);
        return $this->repository->photo($id) ?? throw new \InvalidArgumentException('La foto no existe.');
    }
}
