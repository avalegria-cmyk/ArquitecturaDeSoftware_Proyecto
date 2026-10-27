<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';
use App\Infrastructure\Persistence\{PdoUserRepository, PdoEquipmentRepository, PdoEquipmentWriter, PdoReservationRepository, PdoAuditLog};
use App\Infrastructure\Security\{NativePasswordHasher, JwtSessionGateway};
use App\Infrastructure\System\SystemClock;
use App\Application\Identity\{SignIn, SignOut, CurrentUser, ListUsers};
use App\Application\Equipment\{ListEquipment, CreateEquipment};
use App\Application\Reservations\{CreateReservation, ListAvailability, ListMyReservations, ListResponsibleTeachers, ListApprovals, ReviewReservation};
use App\Domain\Reservations\ReservationPolicy;
use App\Adapters\Http\Controllers\{AuthController, EquipmentController, ReservationController, ApprovalController, LoanController};
use App\Application\Loans\{RecordLoan, ListLoans, ViewLoanPhoto};
use App\Infrastructure\Media\GdPhotoProcessor;
$db = new PDO('mysql:host='.getenv('DB_HOST').';dbname='.getenv('MYSQL_DATABASE').';charset=utf8mb4',
    getenv('MYSQL_USER'), getenv('MYSQL_PASSWORD'), [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES=>false]);
$db->exec("SET time_zone = '+00:00'");
$users = new PdoUserRepository($db);
$sessions = new JwtSessionGateway($db, getenv('JWT_SECRET') ?: '');
$reservations = new PdoReservationRepository($db);
$clock = new SystemClock();
$events = new \App\Adapters\Http\Controllers\EventController(new \App\Application\Realtime\WatchChanges(
    new \App\Infrastructure\Persistence\PdoChangeFeed($db), new CurrentUser($sessions, $users)));
return [
    'events'=>$events,
    'reports'=>new \App\Adapters\Http\Controllers\ReportController(new \App\Application\Reports\EquipmentReport(new \App\Infrastructure\Persistence\PdoEquipmentReportRepository($db), new \App\Infrastructure\Reports\XlsxReportExporter())),
    'maintenanceReview'=>new \App\Adapters\Http\Controllers\MaintenanceController(new \App\Application\Maintenance\CompleteMaintenance(new \App\Infrastructure\Persistence\PdoMaintenanceRepository($db), new GdPhotoProcessor(), $clock)),
    'maintenance'=>new \App\Application\Maintenance\ListMaintenance(new \App\Infrastructure\Persistence\PdoMaintenanceRepository($db)),
    'auth'=>new AuthController(new SignIn($users, new NativePasswordHasher(), $sessions, new PdoAuditLog($db)),
        new SignOut($sessions), getenv('COOKIE_SECURE') === '1'),
    'currentUser'=>new CurrentUser($sessions, $users),
    'users'=>new ListUsers($users),
    'equipment'=>new EquipmentController(new ListEquipment(new PdoEquipmentRepository($db)), new CreateEquipment(new PdoEquipmentWriter($db), new GdPhotoProcessor()), new \App\Application\Equipment\ManageEquipment(new PdoEquipmentWriter($db), new GdPhotoProcessor())),
    'loans'=>new LoanController(new RecordLoan($reservations, new GdPhotoProcessor(), $clock), new ListLoans($reservations), new ViewLoanPhoto($reservations), $clock),
    'approvals'=>new ApprovalController(new ListApprovals($reservations), new ReviewReservation($reservations, $clock)),
    'reservations'=>new ReservationController(
        new CreateReservation($reservations, $users, $clock, new ReservationPolicy()),
        new ListAvailability($reservations, $clock), new ListMyReservations($reservations), new ListResponsibleTeachers($reservations), $clock),
];
