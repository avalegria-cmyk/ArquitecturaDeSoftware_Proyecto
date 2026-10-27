<?php
declare(strict_types=1);
namespace App\Application\Ports;
use App\Domain\Equipment\{Equipment, NewEquipment};
interface EquipmentWriter
{
    public function create(NewEquipment $equipment, int $actorId, array $photos = []): Equipment;
}
