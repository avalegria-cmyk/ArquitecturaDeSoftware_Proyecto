<?php
declare(strict_types=1);
namespace App\Application\Identity;
use App\Application\Ports\{PasswordRepository, UserRepository};
use App\Application\Exceptions\Forbidden;
use App\Domain\Identity\{User, Role};
final readonly class ResetPassword {
    public function __construct(private PasswordRepository $passwords, private UserRepository $users) {}
    public function execute(User $actor, int $userId): void {
        if ($actor->role !== Role::ADMIN) throw new Forbidden('Solo el administrador puede restablecer contraseñas.');
        $target = $this->users->findById($userId);
        if (!$target || !$target->active) throw new \InvalidArgumentException('Selecciona una cuenta activa.');
        $hash = $this->passwords->initialHash($userId);
        if (!$hash) throw new \InvalidArgumentException('Esta cuenta no tiene una contraseña inicial configurada.');
        $this->passwords->replace($userId, $target->passwordHash, $hash, $actor->id, 'auth.password.reset:'.$userId);
    }
}
