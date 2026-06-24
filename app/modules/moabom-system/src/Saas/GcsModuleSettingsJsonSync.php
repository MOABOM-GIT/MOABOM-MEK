<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Module 카테고리 설정 payload → modules 디스크 JSON 동기화 (tenant prefix 적용).
 */
final class GcsModuleSettingsJsonSync
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public static function write(string $moduleIdentifier, string $category, array $payload): bool
    {
        try {
            SaasCachedConfigBridge::applyIfNeeded();
            Storage::forgetDisk('modules');

            if (app()->bound(TenantModuleStorageScope::class)) {
                app(TenantModuleStorageScope::class)->ensureApplied();
            }

            $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
            if ($json === false) {
                return false;
            }

            $path = $moduleIdentifier.'/settings/'.$category.'.json';

            return Storage::disk('modules')->put($path, $json);
        } catch (\Throwable $e) {
            Log::warning('GcsModuleSettingsJsonSync: modules disk write failed', [
                'module' => $moduleIdentifier,
                'category' => $category,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }
}
