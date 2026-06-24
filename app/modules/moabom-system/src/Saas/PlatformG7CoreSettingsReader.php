<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 워커 부팅 시점 platform DB 에서 G7 core settings 카테고리 1건 조회.
 *
 * TenantContext·scoped repository 없이 default connection(moabom-db)만 사용한다.
 */
final class PlatformG7CoreSettingsReader
{
    private const MODULE_KEY = '_g7_core_';

    /**
     * @return array<string, mixed>|null _meta 제외 payload, row 없으면 null
     */
    public static function categoryPayload(string $category): ?array
    {
        try {
            if (! Schema::hasTable('moabom_module_settings')) {
                return null;
            }

            $row = DB::table('moabom_module_settings')
                ->where('module', self::MODULE_KEY)
                ->where('category', $category)
                ->first();

            if ($row === null) {
                return null;
            }

            $payload = $row->payload ?? null;
            if (is_string($payload)) {
                $decoded = json_decode($payload, true);
                $payload = is_array($decoded) ? $decoded : null;
            }

            if (! is_array($payload)) {
                return null;
            }

            unset($payload['_meta']);

            return $payload;
        } catch (\Throwable) {
            return null;
        }
    }
}
