<?php
declare(strict_types=1);
namespace App\Application\Maintenance;
use App\Application\Ports\MaintenanceRepository;
use App\Application\Exceptions\Forbidden;
use App\Domain\Identity\User;
final readonly class ListMaintenance
{
    public function __construct(private MaintenanceRepository $repository) {}
    public function execute(User $actor): array
    {
        if (!$actor->active || !$actor->role->canManageEquipment()) { throw new Forbidden('Solo administrador y encargado pueden consultar mantenimiento.'); }
        return $this->repository->pending();
    }
}
