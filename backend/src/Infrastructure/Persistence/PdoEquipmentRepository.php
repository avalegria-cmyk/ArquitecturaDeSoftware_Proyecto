<?php
declare(strict_types=1);
namespace App\Infrastructure\Persistence;
use App\Application\Ports\EquipmentRepository;
use App\Domain\Equipment\Equipment;
use PDO;
final readonly class PdoEquipmentRepository implements EquipmentRepository {
    public function __construct(private PDO $db) {}
    public function all(): array {
        $images=[];
        foreach ($this->db->query('SELECT id, equipment_id FROM equipment_images ORDER BY id')->fetchAll() as $image) {
            $images[$image['equipment_id']][]=['id'=>(int)$image['id'],'url'=>'/api/equipment/images/'.$image['id']];
        }
        return array_map(fn($r)=>new Equipment((int)$r['id'],$r['code'],$r['name'],$r['category'],$r['status'],$r['location'],$r['description'],$images[$r['id']] ?? []), $this->db->query('SELECT * FROM equipment ORDER BY code')->fetchAll());
    }
}
