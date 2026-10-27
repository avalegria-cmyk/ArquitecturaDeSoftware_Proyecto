<?php
declare(strict_types=1);
namespace App\Application\Ports;
interface EquipmentRepository {
    /** @return \App\Domain\Equipment\Equipment[] */
    public function all(): array;
}
