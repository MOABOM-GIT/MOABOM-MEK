<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Modules\Moabom\System\Saas\LayoutPersistenceNormalizer;
use Modules\Moabom\System\Tests\ModuleTestCase;

final class LayoutPersistenceNormalizerTest extends ModuleTestCase
{
    public function test_normalize_resolves_partial_references_for_social_auth_settings(): void
    {
        $layoutPath = base_path('modules/moabom-social-auth/resources/layouts/admin/admin_social_auth_settings.json');
        $this->assertFileExists($layoutPath);

        $raw = json_decode((string) file_get_contents($layoutPath), true);
        $this->assertIsArray($raw);
        $this->assertTrue($this->arrayContainsUnresolvedPartialReference($raw));

        $normalizer = new LayoutPersistenceNormalizer;
        $normalized = $normalizer->normalize($raw, $layoutPath);

        $this->assertFalse($this->arrayContainsUnresolvedPartialReference($normalized));
        $this->assertSame('google_provider_card', $this->findNestedComponentId($normalized, 'google_provider_card'));
    }

    public function test_normalize_matches_module_refresh_layout_pipeline_for_credit_settings(): void
    {
        $layoutPath = base_path('modules/moabom-credit/resources/layouts/admin/admin_credit_settings.json');
        $this->assertFileExists($layoutPath);

        $raw = json_decode((string) file_get_contents($layoutPath), true);
        $this->assertIsArray($raw);

        $normalizer = new LayoutPersistenceNormalizer;
        $normalized = $normalizer->normalize($raw, $layoutPath);

        $this->assertFalse($this->arrayContainsUnresolvedPartialReference($normalized));
        $this->assertSame('user_credits_tab', $this->findNestedComponentId($normalized, 'user_credits_tab'));
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

    /**
     * @param  array<string, mixed>  $data
     */
    private function findNestedComponentId(array $data, string $id): ?string
    {
        if (($data['id'] ?? null) === $id) {
            return (string) $data['id'];
        }

        foreach ($data as $value) {
            if (! is_array($value)) {
                continue;
            }

            $found = $this->findNestedComponentId($value, $id);
            if ($found !== null) {
                return $found;
            }
        }

        return null;
    }
}
