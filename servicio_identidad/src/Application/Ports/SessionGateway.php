<?php
declare(strict_types=1);
namespace App\Application\Ports;
interface SessionGateway {
    public function issue(int $userId): string;
    public function userId(string $token): ?int;
    public function revoke(string $token): void;
}
