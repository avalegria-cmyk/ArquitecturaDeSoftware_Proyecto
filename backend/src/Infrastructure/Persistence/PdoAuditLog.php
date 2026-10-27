<?php
declare(strict_types=1);
namespace App\Infrastructure\Persistence;
use App\Application\Ports\AuditLog;
use PDO;
final readonly class PdoAuditLog implements AuditLog {
    public function __construct(private PDO $db) {}
    public function record(int $userId, string $action): void {
        $this->db->prepare('INSERT INTO audit_logs (user_id, action) VALUES (?, ?)')->execute([$userId, $action]);
    }
}
