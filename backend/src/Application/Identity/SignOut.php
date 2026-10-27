<?php
declare(strict_types=1);
namespace App\Application\Identity;
use App\Application\Ports\SessionGateway;
final readonly class SignOut {
    public function __construct(private SessionGateway $sessions) {}
    public function execute(string $token): void { $this->sessions->revoke($token); }
}
