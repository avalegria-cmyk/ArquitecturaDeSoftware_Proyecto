<?php
declare(strict_types=1);
namespace App\Application\Ports;
interface PasswordHasher { public function verify(string $password, string $hash): bool; }
