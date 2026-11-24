<?php
declare(strict_types=1);
namespace App\Adapters\Http;
use InvalidArgumentException;
final class Input
{
    public static function id(array $input, string $key): int
    {
        $value = $input[$key] ?? null;
        if (!is_int($value) || $value < 1) { throw new InvalidArgumentException('Selecciona un valor válido para '.$key.'.'); }
        return $value;
    }
}
