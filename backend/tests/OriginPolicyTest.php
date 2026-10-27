<?php
declare(strict_types=1);

namespace Tests;

use App\Adapters\Http\OriginPolicy;
use PHPUnit\Framework\TestCase;

final class OriginPolicyTest extends TestCase
{
    public function testLocalAliasesWorkInBothDirections(): void
    {
        self::assertTrue(OriginPolicy::allows('http://127.0.0.1:8088', 'http://localhost:8088'));
        self::assertTrue(OriginPolicy::allows('http://localhost:8088', 'http://127.0.0.1:8088'));
    }

    public function testUnexpectedOriginsRemainBlocked(): void
    {
        foreach (['http://127.0.0.1:9000', 'https://127.0.0.1:8088', 'http://localhost.evil.test:8088', 'null', 'https://otro-origen.test'] as $origin) {
            self::assertFalse(OriginPolicy::allows($origin, 'http://localhost:8088'));
        }
        self::assertFalse(OriginPolicy::allows('http://localhost:8088', 'https://equipos.universidad.test'));
    }

    public function testConfiguredInstitutionalOriginIsPreserved(): void
    {
        self::assertTrue(OriginPolicy::allows('https://equipos.universidad.test', 'https://equipos.universidad.test'));
    }
}
