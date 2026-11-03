<?php
declare(strict_types=1);

// Importación explícita de cuentas iniciales. No reinicia cuentas existentes.
$password = getenv('INITIAL_PASSWORD');
if (!$password || strlen($password) < 8) {
    fwrite(STDERR, "Define INITIAL_PASSWORD con al menos 8 caracteres.\n");
    exit(1);
}

$users = json_decode(
    file_get_contents(__DIR__ . '/fixtures/course-users.json'),
    true,
    16,
    JSON_THROW_ON_ERROR
);
foreach ($users as $user) {
    if (!filter_var($user['email'], FILTER_VALIDATE_EMAIL)
        || !in_array($user['role'], ['estudiante', 'docente'], true)
        || trim($user['name']) === '') {
        throw new RuntimeException('Cuenta inicial inválida.');
    }
}

$db = new PDO(
    'mysql:host=' . getenv('DB_HOST') . ';dbname=' . getenv('MYSQL_DATABASE') . ';charset=utf8mb4',
    getenv('MYSQL_USER'),
    getenv('MYSQL_PASSWORD'),
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false]
);
$find = $db->prepare('SELECT id FROM users WHERE email = ? OR (name = ? AND role = ?)');
$insert = $db->prepare('INSERT INTO users (name, email, password_hash, role, initial_password_hash) VALUES (?, ?, ?, ?, ?)');
$created = 0;
$preserved = 0;
$db->beginTransaction();
try {
    foreach ($users as $user) {
        $find->execute([$user['email'], $user['name'], $user['role']]);
        if ($find->fetchColumn()) {
            $preserved++;
            continue;
        }
        $initial = $user['role'] === 'estudiante' ? explode('@', $user['email'])[0] : $password;
        $hash = password_hash($initial, PASSWORD_BCRYPT);
        $insert->execute([
            $user['name'], $user['email'],
            $hash, $user['role'], $hash,
        ]);
        $created++;
    }
    $db->commit();
} catch (Throwable $error) {
    $db->rollBack();
    throw $error;
}
echo "Cuentas creadas: {$created}. Cuentas existentes conservadas: {$preserved}.\n";
