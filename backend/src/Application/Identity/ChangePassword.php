<?php
declare(strict_types=1);
namespace App\Application\Identity;
use App\Application\Ports\{PasswordRepository, PasswordHasher, PasswordEncoder};
use App\Domain\Identity\{User, PasswordPolicy};
final readonly class ChangePassword {
    public function __construct(private PasswordRepository $passwords, private PasswordHasher $verifier, private PasswordEncoder $encoder) {}
    public function execute(User $actor, string $current, string $new, string $confirmation): void {
        if (strlen($current) > 200 || !$this->verifier->verify($current, $actor->passwordHash)) {
            throw new \InvalidArgumentException('La contraseña actual es incorrecta.');
        }
        PasswordPolicy::validate($new, $confirmation);
        if ($this->verifier->verify($new, $actor->passwordHash)) {
            throw new \InvalidArgumentException('Elige una contraseña diferente de la actual.');
        }
        $this->passwords->replace($actor->id, $actor->passwordHash, $this->encoder->hash($new), $actor->id, 'auth.password.changed');
    }
}
