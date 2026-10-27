<?php
declare(strict_types=1);

namespace App\Adapters\Http;

final class OriginPolicy
{
    public static function allows(string $origin, string $configuredOrigin): bool
    {
        if ($origin === '' || $origin === $configuredOrigin) {
            return true;
        }

        // Solo los alias locales del origen configurado comparten autorización.
        // Se conserva el esquema y el puerto; no se confía en la cabecera Host.
        $parts = parse_url($configuredOrigin);
        if (!$parts || !in_array($parts['host'] ?? '', ['localhost', '127.0.0.1'], true)) {
            return false;
        }

        $alias = $parts['host'] === 'localhost' ? '127.0.0.1' : 'localhost';
        $allowed = ($parts['scheme'] ?? 'http') . '://' . $alias;
        if (isset($parts['port'])) {
            $allowed .= ':' . $parts['port'];
        }

        return $origin === $allowed;
    }
}
