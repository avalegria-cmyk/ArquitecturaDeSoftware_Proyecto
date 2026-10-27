<?php
declare(strict_types=1);
namespace App\Domain\Equipment;
final readonly class Equipment {
    public function __construct(public int $id, public string $code, public string $name, public string $category, public string $status, public string $location, public string $description, public array $images = []) {}
    public function canBeLoaned(): bool { return $this->status === 'disponible'; }
    public function toArray(): array { return get_object_vars($this); }
}
