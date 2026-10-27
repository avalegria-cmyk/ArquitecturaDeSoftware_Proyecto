<?php
declare(strict_types=1);
namespace App\Adapters\Http;
use InvalidArgumentException;
use DateTimeImmutable;
use DateTimeZone;
use App\Domain\Reservations\TimeSlot;
final class Input
{
    public static function text(array $input, string $key): string
    {
        if (!isset($input[$key]) || !is_string($input[$key])) {
            throw new InvalidArgumentException('El campo '.$key.' es obligatorio y debe ser texto.');
        }
        return trim($input[$key]);
    }
    public static function id(array $input, string $key): int
    {
        $value = $input[$key] ?? null;
        if (!is_int($value) || $value < 1) { throw new InvalidArgumentException('Selecciona un valor válido para '.$key.'.'); }
        return $value;
    }
    public static function slot(array $input): TimeSlot
    {
        return new TimeSlot(self::date(self::text($input, 'startsAt')), self::date(self::text($input, 'endsAt')));
    }
    private static function date(string $value): DateTimeImmutable
    {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i', $value, new DateTimeZone('America/Guayaquil'));
        if (!$date || $date->format('Y-m-d\TH:i') !== $value) {
            throw new InvalidArgumentException('Selecciona fechas y horas válidas en el calendario.');
        }
        return $date;
    }
}
