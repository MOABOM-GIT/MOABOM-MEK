<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Unit;

use Modules\Moabom\Apps\Services\GeneratedAppVersionService;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

class GeneratedAppVersionServiceTest extends TestCase
{
    public function test_normalize_source_defaults_to_save(): void
    {
        $service = new GeneratedAppVersionService(
            $this->createMock(\Modules\Moabom\Apps\Services\GeneratedAppHtmlService::class),
        );
        $method = new ReflectionMethod(GeneratedAppVersionService::class, 'normalizeSource');
        $method->setAccessible(true);

        $this->assertSame('save', $method->invoke($service, 'unknown'));
        $this->assertSame('restore', $method->invoke($service, 'restore'));
        $this->assertSame('patch', $method->invoke($service, 'patch'));
    }
}
