<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Modules\Moabom\System\Models\ModuleSetting;

/**
 * Module 카테고리 페이로드의 DB-backed storage backend.
 *
 * `TenantDatabaseConfigurator::apply` 가 이미 default mysql connection 의 database 를
 * tenant 의 `hospital_{slug}` 또는 platform default 로 전환했음을 가정 (runtime context).
 * 따라서 connection 명시 없이 default 사용 — request 별 정확한 tenant scope.
 *
 * @see deploy/AGENT-FAILURE-ANALYSIS.md §9 — GCS staleness 문제 후 DB 전환 P2
 */
final class TenantModuleSettingsRepository
{
    private const MODULE = 'moabom-system';

    /**
     * @return array<string, mixed>
     */
    public function read(string $category): array
    {
        $row = ModuleSetting::query()
            ->where('module', self::MODULE)
            ->where('category', $category)
            ->first();

        if ($row === null) {
            return [];
        }

        $payload = $row->payload;

        return is_array($payload) ? $payload : [];
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    public function replace(string $category, array $settings): bool
    {
        try {
            ModuleSetting::query()->updateOrCreate(
                ['module' => self::MODULE, 'category' => $category],
                ['payload' => $settings],
            );

            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    public function exists(string $category): bool
    {
        return ModuleSetting::query()
            ->where('module', self::MODULE)
            ->where('category', $category)
            ->exists();
    }
}
