<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Modules\Moabom\System\Saas\LayoutPersistenceNormalizer;
use Modules\Moabom\System\Saas\PlatformModuleLayoutReconciler;
use Modules\Moabom\System\Tests\ModuleTestCase;

final class PlatformModuleLayoutReconcilerPartialTest extends ModuleTestCase
{
    public function test_discover_filesystem_layouts_returns_partial_resolved_data(): void
    {
        $reconciler = app(PlatformModuleLayoutReconciler::class);

        $layouts = $reconciler->discoverFilesystemLayouts('moabom-social-auth');
        $settings = $layouts['moabom-social-auth.admin_social_auth_settings'] ?? null;

        $this->assertIsArray($settings);
        $this->assertFalse($this->arrayContainsUnresolvedPartialReference($settings['data']));
    }

    public function test_served_content_matches_when_both_sides_are_normalized(): void
    {
        $layoutPath = base_path('modules/moabom-social-auth/resources/layouts/admin/admin_social_auth_settings.json');
        $raw = json_decode((string) file_get_contents($layoutPath), true);
        $this->assertIsArray($raw);

        $normalizer = new LayoutPersistenceNormalizer;
        $normalized = $normalizer->normalize($raw, $layoutPath);

        $reconciler = app(PlatformModuleLayoutReconciler::class);

        $this->assertTrue(
            $reconciler->servedContentMatchesFilesystem($normalized, $normalized, (string) ($normalized['version'] ?? '0'))
        );
        $this->assertFalse(
            $reconciler->servedContentMatchesFilesystem($normalized, $raw, (string) ($raw['version'] ?? '0'))
        );
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function arrayContainsUnresolvedPartialReference(array $data): bool
    {
        if (isset($data['partial']) && is_string($data['partial']) && empty($data['_recursive'])) {
            return true;
        }

        foreach ($data as $value) {
            if (is_array($value) && $this->arrayContainsUnresolvedPartialReference($value)) {
                return true;
            }
        }

        return false;
    }
}
