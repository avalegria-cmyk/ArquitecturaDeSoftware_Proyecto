<?php
declare(strict_types=1);
namespace App\Application\Equipment;
use App\Application\Ports\EquipmentRepository;
final readonly class ListEquipment {
    public function __construct(private EquipmentRepository $equipment) {}
    public function execute(): array { return array_map(fn($item) => $item->toArray(), $this->equipment->all()); }
}
