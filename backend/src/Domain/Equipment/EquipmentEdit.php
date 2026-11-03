<?php
declare(strict_types=1);
namespace App\Domain\Equipment;
final readonly class EquipmentEdit
{
    public NewEquipment $details;
    public string $status;
    public function __construct(string $code, string $name, string $category, string $location, string $description, string $status)
    {
        // Valida los datos y el estado solicitado; la transición se confirma con bloqueo en persistencia.
        $this->details = new NewEquipment($code, $name, $category, 'disponible', $location, $description);
        if (!in_array($status, ['disponible','mantenimiento','fuera_servicio','prestado','deshabilitado'], true)) throw new \InvalidArgumentException('Selecciona un estado válido.');
        $this->status = $status;
    }
    public function nextStatus(string $current, bool $hasActiveLoan): string
    {
        if ($this->status === $current) return $current;
        if ($hasActiveLoan || $current === 'prestado') throw new \DomainException('Primero registra la devolución del préstamo activo.');
        if ($current === 'mantenimiento') throw new \DomainException('Habilita este equipo desde Mantenimiento, con foto y comentarios de revisión.');
        if ($this->status === 'prestado') throw new \DomainException('El estado En préstamo se establece al iniciar el uso.');
        if ($this->status === 'deshabilitado') throw new \DomainException('Usa Deshabilitar para dar de baja la unidad.');
        if ($this->status === 'disponible' && !in_array($current, ['fuera_servicio','deshabilitado'], true)) throw new \DomainException('No se puede habilitar este equipo desde el catálogo.');
        if ($current === 'deshabilitado' && $this->status !== 'disponible') throw new \DomainException('Primero habilita la unidad deshabilitada.');
        return $this->status;
    }
    public static function disabledState(string $current, bool $hasActiveLoan): string
    {
        if ($hasActiveLoan || $current === 'prestado') { throw new \DomainException('Primero registra la devolución del préstamo activo antes de deshabilitar la unidad.'); }
        return 'deshabilitado';
    }
}
