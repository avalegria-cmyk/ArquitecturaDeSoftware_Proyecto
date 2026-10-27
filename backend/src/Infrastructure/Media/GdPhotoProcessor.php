<?php
declare(strict_types=1);
namespace App\Infrastructure\Media;
use App\Application\Ports\PhotoProcessor;
use App\Domain\Loans\EvidencePhoto;
use InvalidArgumentException;
final class GdPhotoProcessor implements PhotoProcessor
{
    public function prepare(string $bytes): EvidencePhoto
    {
        if ($bytes === '' || strlen($bytes) > 4 * 1024 * 1024) {
            throw new InvalidArgumentException('La foto debe ocupar como máximo 4 MB después de comprimirla.');
        }
        $size = @getimagesizefromstring($bytes);
        if (!$size || $size[2] !== IMAGETYPE_JPEG || max($size[0], $size[1]) > 2560
            || min($size[0], $size[1]) < 480) {
            throw new InvalidArgumentException('Envía una foto JPEG nítida, con lados de entre 480 y 2560 píxeles.');
        }
        $image = @imagecreatefromstring($bytes);
        if (!$image) { throw new InvalidArgumentException('La imagen está dañada. Toma otra foto.'); }
        // Se comprueba decodificación real. Conserva el JPEG comprimido para no recomprimirlo otra vez.
        imagedestroy($image);
        return new EvidencePhoto($bytes, $size[0], $size[1]);
    }
}
