<?php
declare(strict_types=1);
namespace App\Application\Ports;
use App\Domain\Equipment\EquipmentEdit;
interface EquipmentManager
{
    public function update(int $id, EquipmentEdit $details, array $photos, array $removeIds, int $actorId): void;
    public function disable(int $id, int $actorId): void;
    public function image(int $id): ?string;
}
