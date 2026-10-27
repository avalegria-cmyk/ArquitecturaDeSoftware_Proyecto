<?php
declare(strict_types=1);
namespace App\Application\Reservations;
use App\Application\Ports\ReservationReviewRepository;
use App\Domain\Identity\User;
use App\Domain\Reservations\{ApprovalPolicy, ReservationWorkflow};
final readonly class ListApprovals
{
    public function __construct(private ReservationReviewRepository $reservations) {}
    public function execute(User $actor): array
    {
        $stage = ApprovalPolicy::stageFor($actor);
        return array_map(static function (array $reservation) use ($stage): array {
            $reservation['canDecide'] = ApprovalPolicy::pendingStage($reservation) === $stage;
            $reservation['reviewStage'] = $stage;
            $reservation['timeline'] = ReservationWorkflow::timeline($reservation['events']);
            unset($reservation['events']);
            return $reservation;
        }, $this->reservations->reviewHistory($actor));
    }
}
