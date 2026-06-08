<?php

declare(strict_types=1);

namespace Modules\Moabom\Social\Auth\Services;

use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Social\Auth\Models\SocialAuthSetting;

/**
 * 테넌트 DB에 SNS provider 기본 row를 idempotent seed.
 *
 * credential 은 저장하지 않고 use_master_defaults=true 로 마스터(write DB) 상속.
 */
final class TenantSocialAuthDatabaseSeeder
{
    /** @var list<string> */
    private const PROVIDERS = ['google', 'kakao', 'naver'];

    /**
     * @return array{seeded: bool, created: list<string>, source: string, reason?: string}
     */
    public function seedDefaults(): array
    {
        if (! Schema::hasTable('social_auth_settings')) {
            return [
                'seeded' => false,
                'created' => [],
                'source' => 'table_missing',
                'reason' => 'social_auth_settings table is missing',
            ];
        }

        $created = [];

        foreach (self::PROVIDERS as $provider) {
            /** @var SocialAuthSetting|null $existing */
            $existing = SocialAuthSetting::query()->where('provider', $provider)->first();

            if ($existing !== null) {
                $this->normalizeExistingTenantRow($existing);
                continue;
            }

            SocialAuthSetting::query()->create([
                'provider' => $provider,
                'enabled' => true,
                'use_master_defaults' => true,
                'client_id' => null,
                'client_secret' => null,
                'redirect_uri' => null,
                'google_request_auth_time' => false,
                'kakao_use_client_secret' => true,
                'extra_json' => null,
            ]);

            $created[] = $provider;
        }

        return [
            'seeded' => true,
            'created' => $created,
            'source' => 'db-defaults',
        ];
    }

    private function normalizeExistingTenantRow(SocialAuthSetting $row): void
    {
        $dirty = false;

        if (! $row->enabled) {
            $row->enabled = true;
            $dirty = true;
        }

        if (! $row->use_master_defaults) {
            $row->use_master_defaults = true;
            $dirty = true;
        }

        if ($row->client_id !== null) {
            $row->client_id = null;
            $dirty = true;
        }

        if ($row->client_secret !== null) {
            $row->client_secret = null;
            $dirty = true;
        }

        if ($row->redirect_uri !== null) {
            $row->redirect_uri = null;
            $dirty = true;
        }

        if ($dirty) {
            $row->save();
        }
    }
}
