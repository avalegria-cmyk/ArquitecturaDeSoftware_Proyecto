<?php
declare(strict_types=1);
namespace Tests\Application;
use PHPUnit\Framework\TestCase;
use App\Application\Identity\{SignIn,AuthenticationFailed,ListUsers,CurrentUser};
use App\Application\Ports\{UserRepository,PasswordHasher,SessionGateway,AuditLog};
use App\Domain\Identity\{User,Role};
final class IdentityTest extends TestCase {
    public function testRejectsInactiveUserEvenWithCorrectPassword(): void {
        $repo=$this->createMock(UserRepository::class);$repo->method('findByEmail')->willReturn(new User(1,'Demo','demo@example.test','hash',Role::STUDENT,false));
        $hash=$this->createMock(PasswordHasher::class);$hash->method('verify')->willReturn(true);
        $sessions=$this->createMock(SessionGateway::class);$sessions->expects(self::never())->method('issue');
        $this->expectException(AuthenticationFailed::class);
        (new SignIn($repo,$hash,$sessions,$this->createMock(AuditLog::class)))->execute('demo@example.test','password');
    }
    public function testStudentCannotReadUsers(): void {
        $repo=$this->createMock(UserRepository::class);$repo->expects(self::never())->method('allPublic');
        $this->expectException(\DomainException::class);
        (new ListUsers($repo))->execute(new User(1,'Demo','demo@example.test','hash',Role::STUDENT,true));
    }
    public function testLoginReturnsPublicDataOnly(): void {
        $repo=$this->createMock(UserRepository::class);$repo->method('findByEmail')->willReturn(new User(1,'Demo','demo@example.test','hash',Role::ADMIN,true));
        $hash=$this->createMock(PasswordHasher::class);$hash->method('verify')->willReturn(true);
        $sessions=$this->createMock(SessionGateway::class);$sessions->method('issue')->willReturn('signed-token');
        $result=(new SignIn($repo,$hash,$sessions,$this->createMock(AuditLog::class)))->execute('demo@example.test','password');
        self::assertSame('administrador',$result['user']['role']);self::assertArrayNotHasKey('passwordHash',$result['user']);
    }
    public function testRevokedSessionIsRejected(): void {
        $sessions=$this->createMock(SessionGateway::class);$sessions->method('userId')->willReturn(null);
        $this->expectException(AuthenticationFailed::class);
        (new CurrentUser($sessions,$this->createMock(UserRepository::class)))->execute('revoked-token');
    }
}
