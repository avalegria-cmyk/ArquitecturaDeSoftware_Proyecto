<?php
declare(strict_types=1);
namespace App\Application\Ports;
interface PasswordRepository {
    public function initialHash(int $userId): ?string;
    // Reemplazo y revocación de sesiones se confirman en una transacción.
    // La auditoría se envía después al servicio de Reportes.
    public function replace(int $userId, string $expectedHash, string $newHash): void;
}
