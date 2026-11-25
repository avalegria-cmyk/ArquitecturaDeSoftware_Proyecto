<?php
declare(strict_types=1);
namespace App\Application\Identity;
use App\Application\Ports\{UserRepository, PasswordHasher, SessionGateway, AuditLog};
final readonly class SignIn {
    public function __construct(private UserRepository $users, private PasswordHasher $passwords, private SessionGateway $sessions, private AuditLog $audit) {}
    public function execute(string $email, string $password): array {
        $user = $this->users->findByEmail(strtolower(trim($email)));
        // Hash fijo de relleno para no omitir el coste de verificación si el correo no existe.
        $valid = $this->passwords->verify($password, $user?->passwordHash ?? '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.');
        if (!$user || !$user->active || !$valid) { throw new AuthenticationFailed('Correo o contraseña incorrectos.'); }
        $this->audit->record($user->id, 'auth.login');
        return ['user'=>$user->publicData(), 'token'=>$this->sessions->issue($user->id)];
    }
}
