<?php
declare(strict_types=1);
namespace App\Infrastructure\Security;
use App\Application\Ports\SessionGateway;
use Firebase\JWT\{JWT, Key};
use PDO;
final readonly class JwtSessionGateway implements SessionGateway {
    public function __construct(private PDO $db, private string $secret) {
        if (strlen($secret) < 32 || str_starts_with($secret, 'reemplazar')) { throw new \RuntimeException('Configura JWT_SECRET con una clave aleatoria de al menos 32 caracteres.'); }
    }
    public function issue(int $userId): string {
        $now = time(); $jti = bin2hex(random_bytes(24));
        $this->db->prepare('DELETE FROM auth_sessions WHERE expires_at < UTC_TIMESTAMP()')->execute();
        $this->db->prepare('INSERT INTO auth_sessions (id, user_id, expires_at) VALUES (?, ?, ?)')->execute([$jti,$userId,gmdate('Y-m-d H:i:s',$now+3600)]);
        return JWT::encode(['iss'=>'uniequipos','aud'=>'uniequipos-web','sub'=>(string)$userId,'jti'=>$jti,'iat'=>$now,'exp'=>$now+3600], $this->secret, 'HS256');
    }
    private function claims(string $token): ?object {
        try { $c=JWT::decode($token,new Key($this->secret,'HS256')); }
        catch (\UnexpectedValueException | \InvalidArgumentException $e) { return null; }
        return ($c->iss ?? '') === 'uniequipos' && ($c->aud ?? '') === 'uniequipos-web' && isset($c->sub,$c->jti,$c->exp) ? $c : null;
    }
    public function userId(string $token): ?int {
        $c=$this->claims($token); if (!$c) return null;
        $stmt=$this->db->prepare('SELECT user_id FROM auth_sessions WHERE id=? AND user_id=? AND expires_at>UTC_TIMESTAMP()');
        $stmt->execute([$c->jti,$c->sub]); $id=$stmt->fetchColumn(); return $id ? (int)$id : null;
    }
    public function revoke(string $token): void {
        $c=$this->claims($token); if ($c) $this->db->prepare('DELETE FROM auth_sessions WHERE id=?')->execute([$c->jti]);
    }
}
