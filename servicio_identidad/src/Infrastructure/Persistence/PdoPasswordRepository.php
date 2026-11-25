<?php
declare(strict_types=1);
namespace App\Infrastructure\Persistence;
use App\Application\Ports\PasswordRepository;
use App\Application\Exceptions\Conflict;
use PDO;
final readonly class PdoPasswordRepository implements PasswordRepository {
    public function __construct(private PDO $db) {}
    public function initialHash(int $userId): ?string {
        $query = $this->db->prepare('SELECT initial_password_hash FROM users WHERE id=?');
        $query->execute([$userId]);
        return $query->fetchColumn() ?: null;
    }
    public function replace(int $userId, string $expectedHash, string $newHash): void {
        $this->db->beginTransaction();
        try {
            $query = $this->db->prepare('SELECT password_hash, active FROM users WHERE id=? FOR UPDATE');
            $query->execute([$userId]);
            $row = $query->fetch();
            if (!$row || !$row['active'] || !hash_equals($expectedHash, $row['password_hash'])) {
                throw new Conflict('La cuenta cambió mientras realizabas la operación. Vuelve a intentarlo.');
            }
            $this->db->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([$newHash, $userId]);
            $this->db->prepare('DELETE FROM auth_sessions WHERE user_id=?')->execute([$userId]);
            $this->db->commit();
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            throw $error;
        }
    }
}
