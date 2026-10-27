<?php
declare(strict_types=1);
namespace App\Adapters\Http\Controllers;
use App\Application\Identity\{SignIn, SignOut};
use App\Adapters\Http\Response;
final readonly class AuthController {
    public function __construct(private SignIn $signIn, private SignOut $signOut, private bool $secure) {}
    private function cookie(string $value, int $expires): void {
        setcookie('uni_session',$value,['expires'=>$expires,'path'=>'/api','secure'=>$this->secure,'httponly'=>true,'samesite'=>'Strict']);
    }
    public function login(array $input): never {
        $email=$input['email']??null; $password=$input['password']??null;
        if (!is_string($email) || !filter_var($email,FILTER_VALIDATE_EMAIL) || !is_string($password) || strlen($password)<1 || strlen($password)>200 || strlen($email)>190) Response::json(['message'=>'Ingresa un correo válido y una contraseña.'],422);
        $result=$this->signIn->execute($email,$password); $this->cookie($result['token'],time()+3600);
        Response::json(['user'=>$result['user']]);
    }
    public function logout(string $token): never { $this->signOut->execute($token); $this->cookie('',time()-3600); Response::json(['message'=>'Sesión cerrada.']); }
}
