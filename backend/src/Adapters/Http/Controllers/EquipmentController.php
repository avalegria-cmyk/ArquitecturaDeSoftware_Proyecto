<?php
declare(strict_types=1);
namespace App\Adapters\Http\Controllers;
use App\Application\Equipment\{ListEquipment, CreateEquipment, ManageEquipment};
use App\Adapters\Http\{Response, Input};
use App\Domain\Equipment\NewEquipment;
use App\Domain\Identity\User;
final readonly class EquipmentController
{
    public function __construct(private ListEquipment $list, private CreateEquipment $create, private ManageEquipment $manage) {}
    public function index(): never { Response::json(['equipment'=>$this->list->execute()]); }
    public function store(User $actor, array $input): never
    {
        $equipment = new NewEquipment('AUTO', Input::text($input, 'name'),
            Input::text($input, 'category'), Input::text($input, 'status'), Input::text($input, 'location'), Input::text($input, 'description'));
        Response::json(['equipment'=>$this->create->execute($actor, $equipment, $this->photos($input))], 201);
    }

    private function photos(array $input): array
    {
        $photos=$input['photos'] ?? [];
        if (!is_array($photos) || count($photos)>5) throw new \InvalidArgumentException('Selecciona hasta 5 imágenes.');
        return array_map(static function ($photo): string {
            if (!is_string($photo) || strlen($photo)>5592408 || ($bytes=base64_decode($photo,true))===false) throw new \InvalidArgumentException('La imagen no es válida o supera el límite.');
            return $bytes;
        }, $photos);
    }
    public function update(User $actor,array $input): never
    {
        $remove=$input['removeImageIds'] ?? [];
        if (!is_array($remove) || count($remove)>5) throw new \InvalidArgumentException('Imágenes a retirar no válidas.');
        foreach ($remove as $id) if (!is_int($id) || $id<1) throw new \InvalidArgumentException('Imagen no válida.');
        $details=new \App\Domain\Equipment\EquipmentEdit('AUTO',Input::text($input,'name'),Input::text($input,'category'),Input::text($input,'location'),Input::text($input,'description'));
        $this->manage->update($actor,Input::id($input,'id'),$details,$this->photos($input),$remove);
        Response::json(['message'=>'Equipo modificado.']);
    }
    public function disable(User $actor,array $input): never
    {
        $this->manage->disable($actor,Input::id($input,'id'));Response::json(['message'=>'Equipo deshabilitado. Su historial se conserva.']);
    }
    public function image(int $id): never
    {
        $bytes=$this->manage->image($id);header('Content-Type: image/jpeg');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');echo $bytes;exit;
    }
}
