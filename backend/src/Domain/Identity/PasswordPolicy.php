<?php
declare(strict_types=1);
namespace App\Domain\Identity;
final class PasswordPolicy {
    public static function validate(string $password, string $confirmation): void {
        if (mb_strlen($password) < 8 || strlen($password) > 72 || str_contains($password, "\0") || trim($password) === '') {
            throw new \InvalidArgumentException('La contraseña debe tener al menos 8 caracteres y un máximo de 72 bytes.');
        }
        if ($password !== $confirmation) {
            throw new \InvalidArgumentException('Las contraseñas nuevas no coinciden.');
        }
    }
}
