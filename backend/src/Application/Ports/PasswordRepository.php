<?php
declare(strict_types=1);
namespace App\Application\Ports;
interface PasswordRepository {
    public function initialHash(int $userId): ?string;
    // Reemplazo, revocación de sesiones y auditoría se confirman en una transacción.
    public function replace(int $userId, string $expectedHash, string $newHash, int $actorId, string $action): void;
}
