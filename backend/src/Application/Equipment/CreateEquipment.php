<?php
declare(strict_types=1);
namespace App\Application\Equipment;
use App\Application\Ports\EquipmentWriter;
use App\Application\Exceptions\Forbidden;
use App\Domain\Equipment\NewEquipment;
use App\Domain\Identity\User;
final readonly class CreateEquipment
{
    public function __construct(private EquipmentWriter $equipment, private \App\Application\Ports\PhotoProcessor $photos) {}
    public function execute(User $actor, NewEquipment $input, array $bytes = []): array
    {
        if (!$actor->active || !$actor->role->canManageEquipment()) {
            throw new Forbidden('Solo el administrador y el encargado pueden agregar equipos.');
        }
        return $this->equipment->create($input, $actor->id, array_map(fn(string $bytes) => $this->photos->prepare($bytes), $bytes))->toArray();
    }
}
