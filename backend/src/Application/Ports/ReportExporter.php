<?php
declare(strict_types=1);
namespace App\Application\Ports;
interface ReportExporter { public function export(array $report): string; }
