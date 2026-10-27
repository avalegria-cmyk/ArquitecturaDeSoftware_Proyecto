<?php
declare(strict_types=1);
namespace App\Domain\Loans;
final readonly class EvidencePhoto
{
    public function __construct(public string $bytes, public int $width, public int $height) {}
}
