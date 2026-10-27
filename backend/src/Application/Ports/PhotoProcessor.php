<?php
declare(strict_types=1);
namespace App\Application\Ports;
use App\Domain\Loans\EvidencePhoto;
interface PhotoProcessor { public function prepare(string $bytes): EvidencePhoto; }
