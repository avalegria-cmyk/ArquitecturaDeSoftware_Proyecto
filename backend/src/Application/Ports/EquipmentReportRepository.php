<?php
declare(strict_types=1);
namespace App\Application\Ports;
interface EquipmentReportRepository { public function snapshot(?int $equipmentId): array; }
