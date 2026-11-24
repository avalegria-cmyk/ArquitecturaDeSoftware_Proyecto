<?php
declare(strict_types=1);
use App\Adapters\Http\Response;
use App\Application\Identity\AuthenticationFailed;
use App\Application\Exceptions\{Conflict, Forbidden};
require __DIR__.'/../vendor/autoload.php';
try {
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method === 'GET' && $path === '/health') Response::json(['status'=>'ok', 'service'=>'identidad']);
    // Solo el API Gateway y los otros microservicios conocen el token interno.
    $internal = getenv('INTERNAL_TOKEN') ?: '';
    if ($internal === '' || !hash_equals($internal, $_SERVER['HTTP_X_INTERNAL_TOKEN'] ?? '')) {
        Response::json(['message'=>'Acceso interno no autorizado.'], 403);
    }
    $input = [];
    if ($method === 'POST') {
        try {
            $json = json_decode(file_get_contents('php://input') ?: '{}', false, 16, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) { Response::json(['message'=>'JSON inválido.'], 422); }
        if (!$json instanceof stdClass) Response::json(['message'=>'Se espera un objeto JSON.'], 422);
        $input = (array)$json;
    }
    $app = require __DIR__.'/../bootstrap.php';
    $token = $_COOKIE['uni_session'] ?? '';
    // Rutas internas
    if ($method === 'GET' && $path === '/internal/verify') $app['internal']->verify($token);
    if ($method === 'GET' && $path === '/internal/teachers') $app['internal']->teachers();
    if ($method === 'GET' && preg_match('#^/internal/users/([1-9][0-9]*)$#', $path, $matches)) $app['internal']->user((int)$matches[1]);
    // Rutas públicas (a través del gateway)
    if ($method === 'POST' && $path === '/api/auth/login') $app['auth']->login($input);
    if ($method === 'POST' && $path === '/api/auth/logout') $app['auth']->logout($token);
    $user = $app['currentUser']->execute($token);
    if ($method === 'GET' && $path === '/api/auth/me') Response::json(['user'=>$user->publicData()]);
    if ($method === 'POST' && $path === '/api/auth/password') $app['passwords']->change($user, $input);
    if ($method === 'GET' && $path === '/api/users') Response::json(['users'=>$app['users']->execute($user)]);
    if ($method === 'POST' && $path === '/api/users/reset-password') $app['passwords']->reset($user, $input);
    Response::json(['message'=>'Ruta no encontrada.'], 404);
} catch (AuthenticationFailed $error) { Response::json(['message'=>$error->getMessage()], 401);
} catch (Conflict $error) { Response::json(['message'=>$error->getMessage()], 409);
} catch (InvalidArgumentException $error) { Response::json(['message'=>$error->getMessage()], 422);
} catch (Forbidden | DomainException $error) { Response::json(['message'=>$error->getMessage()], 403);
} catch (Throwable $error) { error_log((string)$error); Response::json(['message'=>'No se pudo completar la solicitud. Revisa la conexión del servidor.'], 500); }
