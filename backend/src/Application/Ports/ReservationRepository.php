<?php
declare(strict_types=1);
namespace App\Application\Ports;
use App\Domain\Reservations\{ReservationRequest, TimeSlot};
use App\Domain\Equipment\Equipment;
interface ReservationRepository
{
    public function transaction(callable $operation): mixed;
    public function lockEquipment(int $equipmentId): ?Equipment;
    /** @return TimeSlot[] */
    public function blockingSlots(int $equipmentId, TimeSlot $slot): array;
    public function available(?TimeSlot $slot): array;
    public function teachers(): array;
    public function findByRequestKey(int $requesterId, string $requestKey): ?array;
    public function create(int $requesterId, ReservationRequest $request): array;
    public function historyFor(int $requesterId): array;
}
