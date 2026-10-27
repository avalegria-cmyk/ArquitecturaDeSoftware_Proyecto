<?php
declare(strict_types=1);
namespace App\Domain\Reservations;
final class ReservationWorkflow
{
    public const STEPS = [
        'enviado' => 'Enviado',
        'docente' => 'Aceptado por docente responsable',
        'jefe_laboratorio' => 'Aceptado por jefe de laboratorio',
        'encargado_laboratorio' => 'Aceptado por encargado de laboratorio',
    ];
    public const INITIAL_STATUS = 'en_revision';
    public const BLOCKING_STATUSES = ['en_revision', 'aceptado'];

    public static function timeline(array $events): array
    {
        $result = [];
        $waiting = false;
        $rejected = false;
        foreach (self::STEPS as $key => $label) {
            $event = null;
            foreach ($events as $candidate) {
                if ($candidate['step'] === $key) { $event = $candidate; break; }
            }
            $state = $event['outcome'] ?? 'pendiente';
            $current = !$waiting && !$rejected && $state === 'pendiente';
            if ($state !== 'completado') { $waiting = true; }
            if ($state === 'rechazado') { $rejected = true; }
            $result[] = [
                'key'=>$key, 'label'=>$label, 'state'=>$state, 'current'=>$current,
                'at'=>$event['at'] ?? null, 'actor'=>$event['actor'] ?? null,
                'note'=>$event['note'] ?? null,
            ];
        }
        return $result;
    }
}
