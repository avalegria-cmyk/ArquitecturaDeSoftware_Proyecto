<?php
declare(strict_types=1);
namespace App\Adapters\Http;
final class Response {
    public static function json(array $body, int $status=200): never {
        http_response_code($status); header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff');
        echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR); exit;
    }
}
