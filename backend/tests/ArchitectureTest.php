<?php
declare(strict_types=1);
namespace Tests;
use PHPUnit\Framework\TestCase;
final class ArchitectureTest extends TestCase {
    public function testInnerLayersDoNotImportOuterLayers(): void {
        foreach (['Domain','Application'] as $layer) {
            $files=new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator(__DIR__.'/../src/'.$layer));
            foreach ($files as $file) {
                if ($file->getExtension()!=='php') continue;
                $source=file_get_contents($file->getPathname());
                self::assertDoesNotMatchRegularExpression('/App\\\\(Infrastructure|Adapters)|use\\s+PDO|Firebase\\\\|\\$_(POST|GET|SERVER|COOKIE)/',$source,$file->getPathname());
                if($layer==='Domain') self::assertStringNotContainsString('App\\Application',$source);
            }
        }
    }
}
