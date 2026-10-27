<?php
declare(strict_types=1);
namespace App\Adapters\Http\Controllers;
use App\Application\Maintenance\CompleteMaintenance;
use App\Domain\Equipment\MaintenanceReview;
use App\Domain\Identity\User;
use App\Adapters\Http\{Input, Response};
final readonly class MaintenanceController
{
    public function __construct(private CompleteMaintenance $complete) {}
    public function store(User $actor, array $input): never
    {
        $review=new MaintenanceReview(Input::id($input, 'equipmentId'), isset($input['loanId']) ? Input::id($input, 'loanId') : null, Input::text($input, 'comments'));
        $encoded=Input::text($input, 'photo');
        if (strlen($encoded)>5592408 || ($bytes=base64_decode($encoded, true)) === false) { throw new \InvalidArgumentException('La foto no es válida o supera 4 MB.'); }
        $this->complete->execute($actor, $review, $bytes);
        Response::json(['message'=>'Revisión registrada. Equipo disponible.']);
    }
    public function history(User $actor): never { Response::json(['reviews'=>$this->complete->history($actor)]); }
    public function photo(User $actor, int $id): never
    {
        $bytes=$this->complete->photo($actor, $id);
        header('Content-Type: image/jpeg'); header('Cache-Control: private, no-store'); header('X-Content-Type-Options: nosniff'); echo $bytes; exit;
    }
}
