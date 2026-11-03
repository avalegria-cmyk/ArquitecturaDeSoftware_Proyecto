<?php
declare(strict_types=1);
// Adaptación explícita solicitada: conserva IDs e historial, no se ejecuta al iniciar la API.
$users = json_decode(file_get_contents(__DIR__.'/fixtures/course-users.json'), true, 16, JSON_THROW_ON_ERROR);
$db = new PDO('mysql:host='.getenv('DB_HOST').';dbname='.getenv('MYSQL_DATABASE').';charset=utf8mb4', getenv('MYSQL_USER'), getenv('MYSQL_PASSWORD'), [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false]);
$find = $db->prepare('SELECT id, name, role FROM users WHERE email=? OR name=? ORDER BY id FOR UPDATE');
$applied = $db->prepare('SELECT id FROM audit_logs WHERE user_id=? AND action=?');
$update = $db->prepare('UPDATE users SET email=?, password_hash=?, initial_password_hash=? WHERE id=?');
$revoke = $db->prepare('DELETE FROM auth_sessions WHERE user_id=?');
$audit = $db->prepare('INSERT INTO audit_logs (user_id, action) VALUES (?,?)');
$action = 'user.student.credentials.espe.v1';
$changed = 0;
$preserved = 0;
$db->beginTransaction();
try {
    foreach ($users as $user) {
        if ($user['role'] !== 'estudiante') continue;
        $find->execute([$user['email'], $user['name']]);
        $matches = $find->fetchAll();
        if (count($matches)!==1 || $matches[0]['name']!==$user['name'] || $matches[0]['role']!=='estudiante') {
            throw new RuntimeException('No se pudo identificar de forma única a '.$user['name'].'. No se aplicaron cambios.');
        }
        $id = (int)$matches[0]['id'];
        $applied->execute([$id, $action]);
        if ($applied->fetchColumn()) { $preserved++; continue; }
        $username = explode('@', $user['email'])[0];
        if (!preg_match('/^[a-z]+@espe\.edu\.ec$/', $user['email'])) throw new RuntimeException('Correo de estudiante inválido.');
        $hash = password_hash($username, PASSWORD_BCRYPT);
        $update->execute([$user['email'], $hash, $hash, $id]);
        $revoke->execute([$id]);
        $audit->execute([$id, $action]);
        $changed++;
    }
    $db->commit();
} catch (Throwable $error) {
    if ($db->inTransaction()) $db->rollBack();
    throw $error;
}
echo "Estudiantes actualizados: {$changed}. Ya adaptados: {$preserved}. ID e historial conservados.\n";
