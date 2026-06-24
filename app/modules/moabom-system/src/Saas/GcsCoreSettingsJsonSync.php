<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * G7 core settings DB payload → settings 디스크 JSON 동기화.
 *
 * MoabomDbConfigRepository 가 DB SSOT 이지만 SettingsServiceProvider 부팅은
 * JsonConfigRepository(GCS/로컬 settings/*.json)를 읽는다. admin 저장 직후 GCS JSON 을
 * 맞춰 두면 배포·워커 재기동 후에도 drivers.storage_driver·websocket_* 가 유지된다.
 */
final class GcsCoreSettingsJsonSync
{
    public static function writeCategory(string $category, array $payload): bool
    {
        try {
            $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            if ($json === false) {
                Log::warning('GcsCoreSettingsJsonSync: JSON encode failed', ['category' => $category]);

                return false;
            }

            Cache::forget('g7_json_settings_category:'.$category);

            return Storage::disk('settings')->put($category.'.json', $json);
        } catch (\Throwable $e) {
            Log::warning('GcsCoreSettingsJsonSync: settings disk write failed', [
                'category' => $category,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }
}
