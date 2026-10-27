<?php
declare(strict_types=1);
namespace App\Domain\Equipment;
final readonly class EquipmentEdit
{
    public NewEquipment $details;
    public function __construct(string $code, string $name, string $category, string $location, string $description)
    {
        // Valida metadatos con las mismas reglas del alta; no modifica el estado operativo.
        $this->details = new NewEquipment($code, $name, $category, 'disponible', $location, $description);
    }
    public static function disabledState(string $current, bool $hasActiveLoan): string
    {
        if ($hasActiveLoan || $current === 'prestado') { throw new \DomainException('Primero registra la devolución del préstamo activo antes de deshabilitar la unidad.'); }
        return 'deshabilitado';
    }
}
