<?php
declare(strict_types=1);
namespace App\Application\Equipment;
use App\Application\Ports\{EquipmentManager, PhotoProcessor};
use App\Domain\Equipment\EquipmentEdit;
use App\Domain\Identity\User;
use App\Application\Exceptions\Forbidden;
final readonly class ManageEquipment
{
    public function __construct(private EquipmentManager $equipment, private PhotoProcessor $photos) {}
    public static function authorize(User $actor): void
    {
        if (!$actor->active || !$actor->role->canManageEquipment()) throw new Forbidden('Solo administrador y encargado pueden modificar o deshabilitar equipos.');
    }
    public function update(User $actor, int $id, EquipmentEdit $details, array $bytes, array $removeIds): void
    {
        self::authorize($actor);
        $photos=array_map(fn(string $image) => $this->photos->prepare($image), $bytes);
        $this->equipment->update($id,$details,$photos,$removeIds,$actor->id);
    }
    public function disable(User $actor,int $id): void { self::authorize($actor); $this->equipment->disable($id,$actor->id); }
    public function image(int $id): string { return $this->equipment->image($id) ?? throw new \InvalidArgumentException('La imagen no existe.'); }
}
