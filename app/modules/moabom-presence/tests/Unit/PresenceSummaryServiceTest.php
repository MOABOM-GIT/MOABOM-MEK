<?php

declare(strict_types=1);

namespace Modules\Moabom\Presence\Tests\Unit;

use Illuminate\Support\Facades\Cache;
use Modules\Moabom\Presence\Contracts\PlatformPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Contracts\TenantPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Services\PresencePlatformMirrorService;
use Modules\Moabom\Presence\Services\PresenceRevisionService;
use Modules\Moabom\Presence\Services\PresenceSummaryService;
use Modules\Moabom\Presence\Support\PresenceChannelNames;
use Modules\Moabom\Presence\Tests\ModuleTestCase;

final class PresenceSummaryServiceTest extends ModuleTestCase
{
    public function test_summary_exposes_mirror_degraded_when_platform_mirror_recently_failed(): void
    {
        Cache::flush();

        $channelNames = $this->createMock(PresenceChannelNames::class);
        $channelNames->method('tenantSlug')->willReturn('acme');
        $channelNames->method('tenantRevisionChannel')->willReturn('module.moabom-presence.tenant.acme.revision');
        $channelNames->method('platformRevisionChannel')->willReturn('module.moabom-presence.platform.revision');
        $channelNames->method('tenantOnlineChannel')->willReturn('module.moabom-presence.tenant.acme.online');

        $tenantSessions = $this->createMock(TenantPresenceSessionRepositoryInterface::class);
        $tenantSessions->method('countConnectVisible')->willReturn(3);

        $platformSessions = $this->createMock(PlatformPresenceSessionRepositoryInterface::class);
        $platformSessions->method('countActive')->willReturn(1);

        $revisionService = $this->createMock(PresenceRevisionService::class);
        $revisionService->method('current')->willReturn(7);

        $platformMirror = $this->createMock(PresencePlatformMirrorService::class);
        $platformMirror->method('isMirrorDegraded')->willReturn(true);

        $service = new PresenceSummaryService(
            $tenantSessions,
            $platformSessions,
            $channelNames,
            $revisionService,
            $platformMirror,
        );

        $summary = $service->getSummary();

        $this->assertTrue($summary['mirror_degraded']);
        $this->assertTrue($summary['mirror_ok']);
        $this->assertSame(3, $summary['tenant_active']);
    }
}
