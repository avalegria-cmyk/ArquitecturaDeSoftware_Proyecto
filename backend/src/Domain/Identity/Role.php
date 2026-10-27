<?php
declare(strict_types=1);
namespace App\Domain\Identity;
enum Role: string {
    case ADMIN = 'administrador';
    case MANAGER = 'encargado';
    case STUDENT = 'estudiante';
    case TEACHER = 'docente';
    public function canManageEquipment(): bool { return in_array($this, [self::ADMIN, self::MANAGER], true); }
}
