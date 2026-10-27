<?php
declare(strict_types=1);
namespace Tests\Domain;
use PHPUnit\Framework\TestCase;
use App\Domain\Equipment\Equipment;
use App\Domain\Reservations\{TimeSlot,ReservationPolicy};
use DateTimeImmutable;
final class ReservationPolicyTest extends TestCase {
    private function slot(string $a,string $b): TimeSlot {return new TimeSlot(new DateTimeImmutable($a),new DateTimeImmutable($b));}
    private function equipment(string $status): Equipment {return new Equipment(1,'LAP-01','Laptop','Computadoras',$status,'Laboratorio','Prueba');}
    public function testRejectsMaintenance(): void {
        $this->expectException(\DomainException::class);
        (new ReservationPolicy())->assertAllowed($this->equipment('mantenimiento'),$this->slot('2030-01-01 08:00','2030-01-01 10:00'),[]);
    }
    public function testRejectsOutOfService(): void {
        $this->expectException(\DomainException::class);
        (new ReservationPolicy())->assertAllowed($this->equipment('fuera_servicio'),$this->slot('2030-01-01 08:00','2030-01-01 10:00'),[]);
    }
    public function testRejectsOverlappingIntervals(): void {
        $this->expectException(\DomainException::class);
        (new ReservationPolicy())->assertAllowed($this->equipment('disponible'),$this->slot('2030-01-01 09:00','2030-01-01 11:00'),[$this->slot('2030-01-01 08:00','2030-01-01 10:00')]);
    }
    public function testAllowsAdjacentIntervals(): void {
        $a=$this->slot('2030-01-01 08:00','2030-01-01 10:00');$b=$this->slot('2030-01-01 10:00','2030-01-01 12:00');
        self::assertFalse($a->overlaps($b));
        (new ReservationPolicy())->assertAllowed($this->equipment('disponible'),$a,[$b]);
    }
    public function testRejectsInvalidInterval(): void {
        $this->expectException(\InvalidArgumentException::class);$this->slot('2030-01-01 12:00','2030-01-01 11:00');
    }
}
