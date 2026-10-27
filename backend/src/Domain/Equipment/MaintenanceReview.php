<?php
declare(strict_types=1);
namespace App\Domain\Equipment;
use App\Domain\Identity\User;
use DomainException;
use InvalidArgumentException;
final readonly class MaintenanceReview
{
    public string $comments;
    public function __construct(public int $equipmentId, public ?int $loanId, string $comments)
    {
        $this->comments = trim($comments);
        if ($equipmentId < 1 || ($loanId !== null && $loanId < 1) || $this->comments === '' || mb_strlen($this->comments) > 2000) {
            throw new InvalidArgumentException('Describe el estado y la revisión realizada (máximo 2000 caracteres).');
        }
    }
    public static function authorize(User $actor): void
    {
        if (!$actor->active || !$actor->role->canManageEquipment()) { throw new DomainException('Solo administrador y encargado pueden registrar revisiones.'); }
    }
    public function assertCurrent(string $status, ?int $latestLoan, bool $activeLoan): void
    {
        if ($status !== 'mantenimiento' || $latestLoan !== $this->loanId || $activeLoan) {
            throw new DomainException('La unidad cambió de estado o de préstamo. Cierra el detalle y consulta la información actualizada.');
        }
    }
}
