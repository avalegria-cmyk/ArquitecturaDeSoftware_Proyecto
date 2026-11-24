<?php
declare(strict_types=1);
namespace App\Infrastructure\Http;
use App\Application\Ports\AuditLog;
/**
 * La bitácora (audit_logs) pertenece al servicio de Reportes.
 * Identidad le envía cada acción por REST; si Reportes no responde, la acción no se pierde del log del contenedor.
 */
final readonly class HttpAuditLog implements AuditLog
{
    public function __construct(private string $url, private string $token) {}
    public function record(int $userId, string $action): void
    {
        $body = json_encode(['userId'=>$userId, 'action'=>$action], JSON_THROW_ON_ERROR);
        $ok = $this->url !== '' && @file_get_contents($this->url, false, stream_context_create(['http'=>[
            'method'=>'POST', 'timeout'=>2, 'ignore_errors'=>false,
            'header'=>"Content-Type: application/json\r\nX-Internal-Token: {$this->token}\r\nX-Service: identidad\r\n",
            'content'=>$body,
        ]])) !== false;
        if (!$ok) error_log('auditoria-pendiente '.$body);
    }
}
