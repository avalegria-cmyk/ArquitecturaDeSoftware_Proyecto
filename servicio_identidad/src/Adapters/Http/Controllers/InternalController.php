<?php
declare(strict_types=1);
namespace App\Adapters\Http\Controllers;
use App\Adapters\Http\Response;
use App\Application\Identity\CurrentUser;
use App\Application\Ports\UserRepository;
/** Rutas que solo usan el API Gateway y los otros microservicios (no pasan por el navegador). */
final readonly class InternalController
{
    public function __construct(private CurrentUser $currentUser, private UserRepository $users) {}
    public function verify(string $token): never
    {
        Response::json(['user'=>$this->currentUser->execute($token)->publicData()]);
    }
    public function teachers(): never { Response::json(['teachers'=>$this->users->teachers()]); }
    public function user(int $id): never
    {
        $user = $this->users->findById($id);
        if (!$user) Response::json(['message'=>'Usuario no encontrado.'], 404);
        Response::json(['user'=>$user->publicData() + ['active'=>$user->active]]);
    }
}
