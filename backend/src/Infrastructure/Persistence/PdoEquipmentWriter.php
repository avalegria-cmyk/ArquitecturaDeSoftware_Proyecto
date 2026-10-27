<?php
declare(strict_types=1);
namespace App\Infrastructure\Persistence;
use App\Application\Ports\{EquipmentWriter, EquipmentManager};
use App\Domain\Equipment\EquipmentEdit;
use App\Application\Exceptions\Conflict;
use App\Domain\Equipment\{Equipment, NewEquipment};
use PDO;
use PDOException;
use Throwable;
final readonly class PdoEquipmentWriter implements EquipmentWriter, EquipmentManager
{
    public function __construct(private PDO $db) {}
    public function create(NewEquipment $equipment, int $actorId, array $photos = []): Equipment
    {
        $this->db->beginTransaction();
        try {
            $code=$this->nextCode($equipment->category);
            $this->db->prepare('INSERT INTO equipment (code, name, category, status, location, description) VALUES (?, ?, ?, ?, ?, ?)')
                ->execute([$code, $equipment->name, $equipment->category, $equipment->status, $equipment->location, $equipment->description]);
            $id = (int)$this->db->lastInsertId();
            $this->savePhotos($id, $photos);
            $this->db->prepare('INSERT INTO audit_logs (user_id, action) VALUES (?, ?)')->execute([$actorId, 'equipment.created:'.$id]);
            $this->db->commit();
            return new Equipment($id, $code, $equipment->name, $equipment->category, $equipment->status, $equipment->location, $equipment->description);
        } catch (Throwable $error) {
            $this->db->rollBack();
            if ($error instanceof PDOException && (int)($error->errorInfo[1] ?? 0) === 1062) {
                throw new Conflict('Ya existe un equipo con ese código. Utiliza un código único.');
            }
            throw $error;
        }
    }

    private function nextCode(string $category): string
    {
        $prefix=\App\Domain\Equipment\EquipmentCode::prefix($category);
        $this->db->prepare('INSERT IGNORE INTO equipment_code_sequences (prefix) VALUES (?)')->execute([$prefix]);
        $query=$this->db->prepare('SELECT last_number FROM equipment_code_sequences WHERE prefix=? FOR UPDATE');
        $query->execute([$prefix]); $last=(int)$query->fetchColumn();
        $query=$this->db->prepare("SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(code, '-', -1) AS UNSIGNED)),0) FROM equipment WHERE code REGEXP ?");
        $query->execute(['^'.$prefix.'-[0-9]+$']);
        $next=max($last,(int)$query->fetchColumn())+1;
        $this->db->prepare('UPDATE equipment_code_sequences SET last_number=? WHERE prefix=?')->execute([$next,$prefix]);
        return $prefix.'-'.str_pad((string)$next,3,'0',STR_PAD_LEFT);
    }

    private function savePhotos(int $id, array $photos): void
    {
        if (count($photos)>5) throw new \InvalidArgumentException('Se permiten hasta 5 imágenes por equipo.');
        foreach ($photos as $photo) {
            $query=$this->db->prepare('INSERT INTO equipment_images (equipment_id, content) VALUES (?, ?)');
            $query->bindValue(1,$id,PDO::PARAM_INT); $query->bindValue(2,$photo->bytes,PDO::PARAM_LOB); $query->execute();
        }
    }
    public function update(int $id, EquipmentEdit $details, array $photos, array $removeIds, int $actorId): void
    {
        $this->db->beginTransaction();
        try {
            $query=$this->db->prepare('SELECT id, code, category FROM equipment WHERE id=? FOR UPDATE'); $query->execute([$id]);
            $current=$query->fetch();
            if (!$current) throw new \InvalidArgumentException('El equipo no existe.');
            foreach ($removeIds as $imageId) $this->db->prepare('DELETE FROM equipment_images WHERE id=? AND equipment_id=?')->execute([$imageId,$id]);
            $query=$this->db->prepare('SELECT COUNT(*) FROM equipment_images WHERE equipment_id=?');$query->execute([$id]);
            if ((int)$query->fetchColumn()+count($photos)>5) throw new \InvalidArgumentException('Puedes guardar hasta 5 imágenes por equipo. Retira alguna imagen antes de agregar más.');
            $e=$details->details;
            $code=mb_strtolower(trim($current['category'])) === mb_strtolower(trim($e->category)) ? $current['code'] : $this->nextCode($e->category);
            $this->db->prepare('UPDATE equipment SET code=?, name=?, category=?, location=?, description=? WHERE id=?')->execute([$code,$e->name,$e->category,$e->location,$e->description,$id]);
            $this->savePhotos($id,$photos);
            $this->db->prepare('INSERT INTO audit_logs (user_id, action) VALUES (?, ?)')->execute([$actorId,'equipment.updated:'.$id]);
            $this->db->commit();
        } catch (Throwable $error) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            if ($error instanceof PDOException && (int)($error->errorInfo[1] ?? 0)===1062) throw new Conflict('Ya existe otro equipo con ese código.');
            throw $error;
        }
    }
    public function disable(int $id,int $actorId): void
    {
        $this->db->beginTransaction();
        try {
            $query=$this->db->prepare('SELECT status FROM equipment WHERE id=? FOR UPDATE');$query->execute([$id]);$status=$query->fetchColumn();
            if ($status===false) throw new \InvalidArgumentException('El equipo no existe.');
            $query=$this->db->prepare('SELECT id FROM loans WHERE equipment_id=? AND returned_at IS NULL FOR UPDATE');$query->execute([$id]);
            $state=EquipmentEdit::disabledState($status,(bool)$query->fetchColumn());
            if ($status!==$state) {
                $this->db->prepare('UPDATE equipment SET status=? WHERE id=?')->execute([$state,$id]);
                $this->db->prepare('INSERT INTO audit_logs (user_id, action) VALUES (?, ?)')->execute([$actorId,'equipment.disabled:'.$id]);
            }
            $this->db->commit();
        } catch (Throwable $error) { if ($this->db->inTransaction()) $this->db->rollBack(); throw $error; }
    }
    public function image(int $id): ?string
    {
        $query=$this->db->prepare('SELECT content FROM equipment_images WHERE id=?');$query->execute([$id]);$bytes=$query->fetchColumn();return $bytes===false ? null : $bytes;
    }
}
