<?php
declare(strict_types=1);
namespace App\Application\Ports;
interface PasswordEncoder { public function hash(string $password): string; }
