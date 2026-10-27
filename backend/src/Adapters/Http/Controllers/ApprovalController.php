<?php
declare(strict_types=1);
namespace App\Adapters\Http\Controllers;
use App\Application\Reservations\{ListApprovals, ReviewReservation};
use App\Adapters\Http\{Response, Input};
use App\Domain\Identity\User;
use App\Domain\Reservations\ApprovalDecision;
final readonly class ApprovalController
{
    public function __construct(private ListApprovals $list, private ReviewReservation $review) {}
    public function index(User $actor): never { Response::json(['reservations'=>$this->list->execute($actor)]); }
    public function decide(User $actor, array $input): never
    {
        $decision = new ApprovalDecision(Input::text($input, 'step'), Input::text($input, 'outcome'), Input::text($input, 'note'));
        Response::json(['reservation'=>$this->review->execute($actor, Input::id($input, 'reservationId'), $decision)]);
    }
}
