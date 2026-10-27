<?php
declare(strict_types=1);
namespace App\Application\Reports;
use App\Application\Ports\{EquipmentReportRepository, ReportExporter};
use App\Domain\Identity\User;
use App\Application\Exceptions\Forbidden;
final readonly class EquipmentReport
{
    public function __construct(private EquipmentReportRepository $repository, private ReportExporter $exporter) {}
    public function execute(User $actor, ?int $id): array
    {
        if (!$actor->active || !$actor->role->canManageEquipment()) { throw new Forbidden('Solo administrador y encargado pueden consultar y exportar reportes.'); }
        return $this->repository->snapshot($id);
    }
    public function export(User $actor, ?int $id): string { return $this->exporter->export($this->execute($actor, $id)); }
}
