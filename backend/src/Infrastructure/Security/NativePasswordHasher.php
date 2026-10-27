<?php
declare(strict_types=1);
namespace App\Infrastructure\Security;
use App\Application\Ports\PasswordHasher;
final class NativePasswordHasher implements PasswordHasher {
    public function verify(string $password, string $hash): bool { return password_verify($password, $hash); }
}
