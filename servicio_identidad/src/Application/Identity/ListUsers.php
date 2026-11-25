<?php
declare(strict_types=1);
namespace App\Application\Identity;
use App\Application\Ports\UserRepository;
use App\Domain\Identity\{Role, User};
final readonly class ListUsers {
    public function __construct(private UserRepository $users) {}
    public function execute(User $actor): array {
        if ($actor->role !== Role::ADMIN) { throw new \DomainException('No tienes permiso para consultar usuarios.'); }
        return $this->users->allPublic();
    }
}
