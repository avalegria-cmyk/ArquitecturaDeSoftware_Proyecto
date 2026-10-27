<?php
declare(strict_types=1);
namespace App\Application\Ports;
use App\Domain\Identity\User;
interface UserRepository {
    public function findByEmail(string $email): ?User;
    public function findById(int $id): ?User;
    public function allPublic(): array;
}
