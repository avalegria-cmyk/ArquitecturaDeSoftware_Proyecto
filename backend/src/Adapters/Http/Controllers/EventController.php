<?php
declare(strict_types=1);
namespace App\Adapters\Http\Controllers;
use App\Application\Realtime\WatchChanges;
use App\Application\Identity\AuthenticationFailed;
use Throwable;
final readonly class EventController
{
    public function __construct(private WatchChanges $watch) {}
    public function stream(string $token): never
    {
        $revision = $this->watch->execute($token);
        set_time_limit(0);
        ini_set('zlib.output_compression', '0');
        while (ob_get_level() > 0) { ob_end_clean(); }
        header('Content-Type: text/event-stream');
        header('Cache-Control: private, no-cache, no-store');
        header('X-Accel-Buffering: no');
        echo "retry: 3000\n\n";
        $this->send('sync', $revision);
        $deadline = microtime(true) + 45;
        try {
            while (!connection_aborted() && microtime(true) < $deadline) {
                sleep(2);
                $next = $this->watch->execute($token);
                if ($next !== $revision) { $revision = $next; $this->send('change', $revision); }
                else { echo ": heartbeat\n\n"; flush(); }
            }
        } catch (AuthenticationFailed $error) {
            echo "event: session-expired\ndata: {}\n\n"; flush();
        } catch (Throwable $error) {
            error_log((string)$error);
            echo "event: reconnect\ndata: {}\n\n"; flush();
        }
        exit;
    }
    private function send(string $event, string $revision): void
    {
        // No transmite identidades, fotos ni datos de reservas de otras cuentas.
        echo 'id: '.$revision."\nevent: ".$event."\ndata: {}\n\n";
        flush();
    }
}
