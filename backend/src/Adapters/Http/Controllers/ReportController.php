<?php
declare(strict_types=1);
namespace App\Adapters\Http\Controllers;
use App\Application\Reports\EquipmentReport;
use App\Domain\Identity\User;
use App\Adapters\Http\Response;
final readonly class ReportController
{
    public function __construct(private EquipmentReport $report) {}
    public function index(User $actor, array $query, bool $export=false): never
    {
        $id=null;
        if (isset($query['equipmentId'])) {
            $id=filter_var($query['equipmentId'], FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]]);
            if ($id === false) throw new \InvalidArgumentException('Selecciona un equipo válido.');
        }
        if (!$export) Response::json($this->report->execute($actor,$id));
        $bytes=$this->report->export($actor,$id);
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="UniEquipos-'.($id ? 'equipo-'.$id : 'general').'.xlsx"');
        header('Cache-Control: private, no-store'); header('Content-Length: '.strlen($bytes)); echo $bytes; exit;
    }
}
