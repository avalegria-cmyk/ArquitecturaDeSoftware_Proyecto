<?php
declare(strict_types=1);
// Adaptación explícita para cuentas ya creadas. No cambia contraseñas vigentes.
$demo = getenv('DEMO_PASSWORD');
$course = getenv('INITIAL_PASSWORD');
if (!$demo || strlen($demo)<12 || !$course || strlen($course)<8) {
    fwrite(STDERR, "Define DEMO_PASSWORD e INITIAL_PASSWORD con los valores iniciales de esta instalación.\n");
    exit(1);
}
$db = new PDO('mysql:host='.getenv('DB_HOST').';dbname='.getenv('MYSQL_DATABASE').';charset=utf8mb4', getenv('MYSQL_USER'), getenv('MYSQL_PASSWORD'), [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$update = $db->prepare('UPDATE users SET initial_password_hash=? WHERE email=? AND initial_password_hash IS NULL');
$db->beginTransaction();
try {
    foreach (['administrador','encargado','estudiante','docente'] as $role) {
        $update->execute([password_hash($demo, PASSWORD_BCRYPT), $role.'@demo.uniequipos.test']);
    }
    foreach (json_decode(file_get_contents(__DIR__.'/fixtures/course-users.json'), true, 16, JSON_THROW_ON_ERROR) as $user) {
        $initial = $user['role'] === 'estudiante' ? explode('@', $user['email'])[0] : $course;
        $update->execute([password_hash($initial, PASSWORD_BCRYPT), $user['email']]);
    }
    $db->commit();
} catch (Throwable $error) {
    $db->rollBack();
    throw $error;
}
echo "Contraseñas iniciales configuradas sin modificar las actuales.\n";
