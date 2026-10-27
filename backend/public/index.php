<?php
declare(strict_types=1);
use App\Adapters\Http\{Response, OriginPolicy};
use App\Application\Identity\AuthenticationFailed;
use App\Application\Exceptions\{Conflict, Forbidden};
require __DIR__.'/../vendor/autoload.php';
try {
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method === 'GET' && $path === '/api/health') Response::json(['status'=>'ok']);
    if (!in_array($method, ['GET', 'POST'], true)) Response::json(['message'=>'Método no permitido.'], 405);
    $input = [];
    if ($method === 'POST') {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if (!OriginPolicy::allows($origin, getenv('APP_ORIGIN') ?: 'http://localhost:8088')
            || ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'UniEquipos'
            || !str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) {
            Response::json(['message'=>'Origen o formato de solicitud no permitido.'], 403);
        }
        try {
            $json = json_decode(file_get_contents('php://input'), false, 16, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) { Response::json(['message'=>'JSON inválido.'], 422); }
        if (!$json instanceof stdClass) Response::json(['message'=>'Se espera un objeto JSON.'], 422);
        $input = (array)$json;
    }
    $app = require __DIR__.'/../bootstrap.php';
    $token = $_COOKIE['uni_session'] ?? '';
    if ($method === 'POST' && $path === '/api/auth/login') $app['auth']->login($input);
    if ($method === 'POST' && $path === '/api/auth/logout') $app['auth']->logout($token);
    if ($method === 'GET' && $path === '/api/events') $app['events']->stream($token);
    $user = $app['currentUser']->execute($token);
    if ($method === 'GET' && $path === '/api/auth/me') Response::json(['user'=>$user->publicData()]);
    if ($method === 'POST' && $path === '/api/equipment/update') $app['equipment']->update($user,$input);
    if ($method === 'POST' && $path === '/api/equipment/disable') $app['equipment']->disable($user,$input);
    if ($method === 'GET' && preg_match('#^/api/equipment/images/([1-9][0-9]*)$#',$path,$matches)) $app['equipment']->image((int)$matches[1]);
    if ($method === 'GET' && $path === '/api/equipment') $app['equipment']->index();
    if ($method === 'POST' && $path === '/api/equipment') $app['equipment']->store($user, $input);
    if ($method === 'GET' && $path === '/api/users') Response::json(['users'=>$app['users']->execute($user)]);
    if ($method === 'GET' && $path === '/api/reservations') $app['reservations']->index($user);
    if ($method === 'POST' && $path === '/api/reservations') $app['reservations']->store($user, $input);
    if ($method === 'GET' && $path === '/api/reservations/teachers') $app['reservations']->teachers();
    if ($method === 'GET' && $path === '/api/reservations/availability') $app['reservations']->availability($_GET);
    if ($method === 'GET' && $path === '/api/approvals') $app['approvals']->index($user);
    if ($method === 'POST' && $path === '/api/approvals/decision') $app['approvals']->decide($user, $input);
    if ($method === 'POST' && $path === '/api/maintenance/complete') $app['maintenanceReview']->store($user, $input);
    if ($method === 'GET' && $path === '/api/maintenance/reviews') $app['maintenanceReview']->history($user);
    if ($method === 'GET' && preg_match('#^/api/maintenance/reviews/([1-9][0-9]*)/photo$#', $path, $matches)) $app['maintenanceReview']->photo($user, (int)$matches[1]);
    if ($method === 'GET' && $path === '/api/reports') $app['reports']->index($user, $_GET);
    if ($method === 'GET' && $path === '/api/reports/export') $app['reports']->index($user, $_GET, true);
    if ($method === 'GET' && $path === '/api/maintenance') Response::json(['equipment'=>$app['maintenance']->execute($user)]);
    if ($method === 'GET' && $path === '/api/loans') $app['loans']->index($user);
    if ($method === 'POST' && $path === '/api/loans/start') $app['loans']->store($user, $input, 'inicio');
    if ($method === 'POST' && $path === '/api/loans/return') $app['loans']->store($user, $input, 'devolucion');
    if ($method === 'GET' && preg_match('#^/api/loans/([1-9][0-9]*)/photos/(inicio|devolucion)$#', $path, $matches)) {
        $app['loans']->photo($user, (int)$matches[1], $matches[2]);
    }
    Response::json(['message'=>'Ruta no encontrada.'], 404);
} catch (AuthenticationFailed $error) { Response::json(['message'=>$error->getMessage()], 401);
} catch (Conflict $error) { Response::json(['message'=>$error->getMessage()], 409);
} catch (InvalidArgumentException $error) { Response::json(['message'=>$error->getMessage()], 422);
} catch (Forbidden | DomainException $error) { Response::json(['message'=>$error->getMessage()], 403);
} catch (Throwable $error) { error_log((string)$error); Response::json(['message'=>'No se pudo completar la solicitud. Revisa la conexión del servidor.'], 500); }
