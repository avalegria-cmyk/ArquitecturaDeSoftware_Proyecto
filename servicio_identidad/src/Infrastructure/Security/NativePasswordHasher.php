<?php
declare(strict_types=1);
namespace App\Infrastructure\Security;
use App\Application\Ports\PasswordHasher;
final class NativePasswordHasher implements PasswordHasher, \App\Application\Ports\PasswordEncoder {
    public function hash(string $password): string { return password_hash($password, PASSWORD_BCRYPT); }
    public function verify(string $password, string $hash): bool { return password_verify($password, $hash); }
}
