<?php
declare(strict_types=1);
namespace App\Application\Ports;
interface AuditLog { public function record(int $userId, string $action): void; }
