<?php
declare(strict_types=1);
namespace App\Infrastructure\Persistence;
use App\Application\Ports\UserRepository;
use App\Domain\Identity\{User, Role};
use PDO;
final readonly class PdoUserRepository implements UserRepository {
    public function __construct(private PDO $db) {}
    private function find(string $column, mixed $value): ?User {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE {$column} = ?");
        $stmt->execute([$value]); $r = $stmt->fetch();
        return $r ? new User((int)$r['id'], $r['name'], $r['email'], $r['password_hash'], Role::from($r['role']), (bool)$r['active']) : null;
    }
    public function findByEmail(string $email): ?User { return $this->find('email', $email); }
    public function findById(int $id): ?User { return $this->find('id', $id); }
    public function allPublic(): array { return $this->db->query('SELECT id, name, email, role, active FROM users ORDER BY name')->fetchAll(); }
}
