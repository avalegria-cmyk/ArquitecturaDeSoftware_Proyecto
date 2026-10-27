<?php
declare(strict_types=1);
namespace App\Application\Realtime;
use App\Application\Ports\ChangeFeed;
use App\Application\Identity\CurrentUser;
final readonly class WatchChanges
{
    public function __construct(private ChangeFeed $feed, private CurrentUser $identity) {}
    public function execute(string $token): string
    {
        $this->identity->execute($token);
        return $this->feed->revision();
    }
}
