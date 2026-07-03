<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Unit;

use Illuminate\Support\Facades\Crypt;
use Modules\Moabom\Apps\Services\WebsiteLinkIconAccessService;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class WebsiteLinkIconAccessServiceTest extends ModuleTestCase
{
    public function test_issue_and_validate_icon_token(): void
    {
        $service = new WebsiteLinkIconAccessService;
        $token = $service->issueToken(42);

        $this->assertTrue($service->validatesAccess(42, $token));
        $this->assertFalse($service->validatesAccess(43, $token));
        $this->assertFalse($service->validatesAccess(42, null));
    }

    public function test_rejects_expired_icon_token(): void
    {
        $expired = Crypt::encryptString(json_encode([
            'app_id' => 7,
            'purpose' => 'website_icon',
            'exp' => now()->subMinute()->timestamp,
        ], JSON_THROW_ON_ERROR));

        $service = new WebsiteLinkIconAccessService;

        $this->assertFalse($service->validatesAccess(7, $expired));
    }

    public function test_append_token_to_icon_path(): void
    {
        $service = new WebsiteLinkIconAccessService;
        $path = $service->appendTokenToIconPath('/api/modules/moabom-apps/apps/generated/3/website-icon', 3);

        $this->assertStringContainsString('icon_token=', $path);

        parse_str((string) parse_url($path, PHP_URL_QUERY), $query);
        $this->assertTrue($service->validatesAccess(3, is_string($query['icon_token'] ?? null) ? $query['icon_token'] : null));
    }
}
