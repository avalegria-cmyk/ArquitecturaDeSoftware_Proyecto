<?php
declare(strict_types=1);
namespace App\Adapters\Http\Controllers;
use App\Application\Identity\{ChangePassword, ResetPassword};
use App\Adapters\Http\{Input, Response};
use App\Domain\Identity\User;
final readonly class PasswordController {
    public function __construct(private ChangePassword $change, private ResetPassword $reset, private bool $secure) {}
    private function clearCookie(): void {
        setcookie('uni_session', '', ['expires'=>time()-3600, 'path'=>'/api', 'secure'=>$this->secure, 'httponly'=>true, 'samesite'=>'Strict']);
    }
    public function change(User $actor, array $input): never {
        foreach (['currentPassword', 'newPassword', 'confirmation'] as $key) {
            if (!isset($input[$key]) || !is_string($input[$key])) throw new \InvalidArgumentException('Completa los campos de contraseña.');
        }
        // No recortar espacios: forman parte de la contraseña.
        $this->change->execute($actor, $input['currentPassword'], $input['newPassword'], $input['confirmation']);
        $this->clearCookie();
        Response::json(['message'=>'Contraseña actualizada. Inicia sesión con tu nueva contraseña.']);
    }
    public function reset(User $actor, array $input): never {
        $id = Input::id($input, 'userId');
        $this->reset->execute($actor, $id);
        if ($id === $actor->id) $this->clearCookie();
        Response::json(['message'=>'Contraseña inicial restablecida. Las sesiones de la cuenta se cerraron.']);
    }
}
