<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use App\Repositories\JsonConfigRepository;

/**
 * SettingsServiceProvider 부팅용 — platform DB 가 GCS JSON 보다 우선.
 */
final class PlatformBootSettingsRepository extends JsonConfigRepository
{
    /**
     * @return array<string, mixed>
     */
    protected function readCategoryFromStorage(string $category): array
    {
        $base = parent::readCategoryFromStorage($category);
        $fromDb = PlatformG7CoreSettingsReader::categoryPayload($category);
        if ($fromDb === null) {
            return $base;
        }

        return array_merge($base, $fromDb);
    }
}
