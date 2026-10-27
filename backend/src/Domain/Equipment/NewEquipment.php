<?php
declare(strict_types=1);
namespace App\Domain\Equipment;
use InvalidArgumentException;
final readonly class NewEquipment
{
    public function __construct(
        public string $code,
        public string $name,
        public string $category,
        public string $status,
        public string $location,
        public string $description
    ) {
        foreach (['code'=>30, 'name'=>120, 'category'=>60, 'location'=>120, 'description'=>2000] as $field=>$max) {
            if (trim($this->$field) === '' || mb_strlen($this->$field) > $max) {
                throw new InvalidArgumentException('Completa los campos del equipo y respeta sus límites de longitud.');
            }
        }
        if (!preg_match('/^[A-Z0-9][A-Z0-9._-]{0,29}$/D', $code)) {
            throw new InvalidArgumentException('El código admite letras, números, puntos, guiones y guiones bajos.');
        }
        if (!in_array($status, ['disponible', 'mantenimiento', 'fuera_servicio'], true)) {
            throw new InvalidArgumentException('Selecciona un estado inicial válido. Un préstamo se registra desde su módulo.');
        }
    }
}
