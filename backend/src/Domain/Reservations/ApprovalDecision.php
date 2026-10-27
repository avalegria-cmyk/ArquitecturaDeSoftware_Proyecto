<?php
declare(strict_types=1);
namespace App\Domain\Reservations;
use InvalidArgumentException;
final readonly class ApprovalDecision
{
    public string $note;
    public function __construct(public string $step, public string $outcome, string $note)
    {
        $this->note = trim($note);
        if (!in_array($step, ['docente', 'jefe_laboratorio', 'encargado_laboratorio'], true)
            || !in_array($outcome, ['completado', 'rechazado'], true)) {
            throw new InvalidArgumentException('Selecciona una etapa y una decisión válidas.');
        }
        if (mb_strlen($this->note) > 1000) { throw new InvalidArgumentException('La observación admite hasta 1000 caracteres.'); }
        if ($outcome === 'rechazado' && $this->note === '') {
            throw new InvalidArgumentException('Indica el motivo del rechazo.');
        }
    }
}
