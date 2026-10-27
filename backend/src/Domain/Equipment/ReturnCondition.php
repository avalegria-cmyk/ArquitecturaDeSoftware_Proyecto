<?php
declare(strict_types=1);
namespace App\Domain\Equipment;
final class ReturnCondition
{
    public static function afterUse(string $current): string
    {
        // Una baja previa no debe rehabilitarse por registrar una devolución.
        return in_array($current, ['fuera_servicio','deshabilitado'], true) ? $current : 'mantenimiento';
    }
}
