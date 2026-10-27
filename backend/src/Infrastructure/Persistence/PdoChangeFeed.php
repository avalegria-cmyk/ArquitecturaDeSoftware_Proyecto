<?php
declare(strict_types=1);
namespace App\Infrastructure\Persistence;
use App\Application\Ports\ChangeFeed;
use PDO;
final readonly class PdoChangeFeed implements ChangeFeed
{
    public function __construct(private PDO $db) {}
    public function revision(): string
    {
        // COUNT detecta commits fuera del orden de asignación de IDs; solo cambios confirmados.
        $row = $this->db->query("SELECT COUNT(*) AS total, COALESCE(MAX(id),0) AS last_id FROM audit_logs
            WHERE action LIKE 'equipment.%' OR action LIKE 'reservation.%' OR action LIKE 'loan.%'")->fetch();
        return $row['total'].':'.$row['last_id'];
    }
}
