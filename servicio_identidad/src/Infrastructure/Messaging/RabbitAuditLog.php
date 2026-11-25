<?php
declare(strict_types=1);
namespace App\Infrastructure\Messaging;
use App\Application\Ports\AuditLog;
use PhpAmqpLib\Connection\AMQPStreamConnection;
use PhpAmqpLib\Message\AMQPMessage;
/**
 * Publica cada acción como evento en RabbitMQ (exchange `uniequipos.eventos`).
 * Reportes la guarda en la bitácora cuando la lee de su cola, aunque en este momento esté apagado.
 */
final class RabbitAuditLog implements AuditLog
{
    public function __construct(private readonly string $url) {}

    public function record(int $userId, string $action): void
    {
        $evento = json_encode(['userId'=>$userId, 'action'=>$action, 'service'=>'identidad', 'at'=>gmdate('Y-m-d\TH:i:s\Z')], JSON_THROW_ON_ERROR);
        try {
            $p = parse_url($this->url);
            $conexion = new AMQPStreamConnection($p['host'], $p['port'] ?? 5672, urldecode($p['user'] ?? 'guest'), urldecode($p['pass'] ?? 'guest'),
                connection_timeout: 2.0, read_write_timeout: 2.0);
            $canal = $conexion->channel();
            $canal->exchange_declare('uniequipos.eventos', 'topic', false, true, false);
            $mensaje = new AMQPMessage($evento, ['content_type'=>'application/json', 'delivery_mode'=>AMQPMessage::DELIVERY_MODE_PERSISTENT, 'app_id'=>'identidad']);
            $canal->basic_publish($mensaje, 'uniequipos.eventos', explode(':', $action)[0]);
            $canal->close();
            $conexion->close();
        } catch (\Throwable $error) {
            // El inicio de sesión no debe fallar porque el broker no responda.
            error_log('evento-pendiente '.$evento.' '.$error->getMessage());
        }
    }
}
