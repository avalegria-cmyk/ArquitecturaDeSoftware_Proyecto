<?php
declare(strict_types=1);
// Ejecución explícita y únicamente para desarrollo. No modifica usuarios existentes.
$db=new PDO('mysql:host='.getenv('DB_HOST').';dbname='.getenv('MYSQL_DATABASE').';charset=utf8mb4',getenv('MYSQL_USER'),getenv('MYSQL_PASSWORD'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$password=getenv('DEMO_PASSWORD');
if (!$password || strlen($password)<12) {fwrite(STDERR,"Define DEMO_PASSWORD con al menos 12 caracteres.\n");exit(1);}
$db->beginTransaction();
foreach (['administrador'=>'Administración demo','encargado'=>'Encargado demo','estudiante'=>'Estudiante demo','docente'=>'Docente demo'] as $role=>$name) {
 $q=$db->prepare('SELECT id FROM users WHERE email=?');$q->execute([$role.'@demo.uniequipos.test']);
 if (!$q->fetchColumn()) $db->prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)')->execute([$name,$role.'@demo.uniequipos.test',password_hash($password,PASSWORD_BCRYPT),$role]);
}
foreach (json_decode(file_get_contents(__DIR__.'/../database/demo-equipment.json'),true) as $e) {
 $q=$db->prepare('SELECT id FROM equipment WHERE code=?');$q->execute([$e['code']]);
 if (!$q->fetchColumn()) $db->prepare('INSERT INTO equipment (code,name,category,status,location,description) VALUES (?,?,?,?,?,?)')->execute([$e['code'],$e['name'],$e['category'],$e['status'],$e['location'],$e['description']]);
}
$db->commit();echo "Datos de demostración preparados. No se modificaron registros existentes.\n";
