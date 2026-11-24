<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';
use App\Infrastructure\Persistence\{PdoUserRepository, PdoPasswordRepository};
use App\Infrastructure\Security\{NativePasswordHasher, JwtSessionGateway};
use App\Infrastructure\Http\HttpAuditLog;
use App\Application\Identity\{SignIn, SignOut, CurrentUser, ListUsers, ChangePassword, ResetPassword};
use App\Adapters\Http\Controllers\{AuthController, PasswordController, InternalController};
$db = new PDO('mysql:host='.getenv('DB_HOST').';dbname='.getenv('DB_NAME').';charset=utf8mb4',
    getenv('DB_USER'), getenv('DB_PASSWORD'), [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false]);
$db->exec("SET time_zone = '+00:00'");
$secure = getenv('COOKIE_SECURE') === '1';
$users = new PdoUserRepository($db);
$sessions = new JwtSessionGateway($db, getenv('JWT_SECRET') ?: '');
$hasher = new NativePasswordHasher();
$audit = new HttpAuditLog(getenv('AUDIT_URL') ?: '', getenv('INTERNAL_TOKEN') ?: '');
$passwords = new PdoPasswordRepository($db);
$currentUser = new CurrentUser($sessions, $users);
return [
    'auth'=>new AuthController(new SignIn($users, $hasher, $sessions, $audit), new SignOut($sessions), $secure),
    'passwords'=>new PasswordController(new ChangePassword($passwords, $hasher, $hasher, $audit),
        new ResetPassword($passwords, $users, $audit), $secure),
    'internal'=>new InternalController($currentUser, $users),
    'currentUser'=>$currentUser,
    'users'=>new ListUsers($users),
];
