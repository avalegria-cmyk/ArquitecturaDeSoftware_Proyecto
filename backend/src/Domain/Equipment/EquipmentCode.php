<?php
declare(strict_types=1);
namespace App\Domain\Equipment;
final class EquipmentCode
{
    public static function prefix(string $category): string
    {
        return match (mb_strtolower(trim($category))) {
            'computadoras', 'laptops' => 'LAP',
            'cámaras', 'camaras' => 'CAM',
            'proyectores' => 'PRO',
            'iot y electrónica', 'iot y electronica' => 'IOT',
            'laboratorio' => 'LAB',
            'audiovisuales' => 'AV',
            default => 'EQ',
        };
    }
}
