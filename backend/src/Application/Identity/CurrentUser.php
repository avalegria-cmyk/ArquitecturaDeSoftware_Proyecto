<?php
declare(strict_types=1);
namespace App\Application\Identity;
use App\Application\Ports\{SessionGateway, UserRepository};
use App\Domain\Identity\User;
final readonly class CurrentUser {
    public function __construct(private SessionGateway $sessions, private UserRepository $users) {}
    public function execute(string $token): User {
        $id = $this->sessions->userId($token);
        $user = $id ? $this->users->findById($id) : null;
        if (!$user || !$user->active) { throw new AuthenticationFailed('La sesión terminó. Inicia sesión nuevamente.'); }
        return $user;
    }
}
