<?php
declare(strict_types=1);
namespace App\Domain\Identity;
final readonly class User {
    public function __construct(public int $id, public string $name, public string $email, public string $passwordHash, public Role $role, public bool $active) {}
    public function publicData(): array { return ['id'=>$this->id, 'name'=>$this->name, 'email'=>$this->email, 'role'=>$this->role->value]; }
}
