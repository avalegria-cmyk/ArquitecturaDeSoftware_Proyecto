<?php
declare(strict_types=1);

// Importación explícita de cuentas iniciales. No reinicia cuentas existentes.
$password = getenv('INITIAL_PASSWORD');
if (!$password || strlen($password) < 8) {
    fwrite(STDERR, "Define INITIAL_PASSWORD con al menos 8 caracteres.\n");
    exit(1);
}

$users = json_decode(
    file_get_contents(__DIR__ . '/../database/course-users.json'),
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
$find = $db->prepare('SELECT id FROM users WHERE email = ?');
$insert = $db->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
$created = 0;
$preserved = 0;
$db->beginTransaction();
try {
    foreach ($users as $user) {
        $find->execute([$user['email']]);
        if ($find->fetchColumn()) {
            $preserved++;
            continue;
        }
        $insert->execute([
            $user['name'], $user['email'],
            password_hash($password, PASSWORD_BCRYPT), $user['role'],
        ]);
        $created++;
    }
    $db->commit();
} catch (Throwable $error) {
    $db->rollBack();
    throw $error;
}
echo "Cuentas creadas: {$created}. Cuentas existentes conservadas: {$preserved}.\n";
