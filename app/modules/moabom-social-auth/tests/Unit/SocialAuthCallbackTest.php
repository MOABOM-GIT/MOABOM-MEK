<?php

namespace Modules\Moabom\Social\Auth\Tests\Unit;

use Modules\Moabom\Social\Auth\Support\SocialAuthCallback;
use Modules\Moabom\Social\Auth\Support\SocialAuthProviders;
use Modules\Moabom\Social\Auth\Tests\ModuleTestCase;

require_once dirname(__DIR__).'/ModuleTestCase.php';

class SocialAuthCallbackTest extends ModuleTestCase
{
    public function test_absolute_url_uses_app_url_and_matches_relative_path(): void
    {
        $expectedPath = '/api/modules/moabom-social-auth/google/callback';

        $this->assertSame($expectedPath, SocialAuthCallback::relativePath('google'));
        $this->assertStringEndsWith($expectedPath, SocialAuthCallback::absoluteUrl('google'));
    }

    public function test_all_absolute_urls_contains_three_providers(): void
    {
        $urls = SocialAuthCallback::allAbsoluteUrls();

        $this->assertCount(3, $urls);
        foreach (SocialAuthProviders::all() as $provider) {
            $this->assertArrayHasKey($provider, $urls);
            $this->assertStringEndsWith(
                SocialAuthCallback::relativePath($provider),
                $urls[$provider]
            );
        }
    }
}
