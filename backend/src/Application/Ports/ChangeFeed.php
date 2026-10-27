<?php
declare(strict_types=1);
namespace App\Application\Ports;
interface ChangeFeed { public function revision(): string; }
