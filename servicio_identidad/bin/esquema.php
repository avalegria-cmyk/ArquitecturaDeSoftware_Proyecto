<?php
declare(strict_types=1);
// Crea las tablas de identidad_db al arrancar el contenedor (espera a que MySQL esté listo).
for ($i = 0; $i < 30; $i++) {
    try {
        $db = new PDO('mysql:host='.getenv('DB_HOST').';dbname='.getenv('DB_NAME').';charset=utf8mb4',
            getenv('DB_USER'), getenv('DB_PASSWORD'), [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
        $db->exec(file_get_contents(__DIR__.'/../database/schema.sql'));
        echo "Esquema de identidad listo.\n";
        exit(0);
    } catch (PDOException $error) {
        fwrite(STDERR, "Esperando la base de datos...\n");
        sleep(2);
    }
}
exit(1);
