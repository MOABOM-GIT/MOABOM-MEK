<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use App\Extension\ModuleManager;
use Illuminate\Support\Facades\File;

/**
 * filesystem `resources/layouts/{admin|user}/*.json` 보유 모듈 SSOT.
 *
 * moabom:saas:sync-module-layouts 가 단일 모듈(moabom-system)만 갱신하면
 * moabom-apps.admin_* 등 신규 layout 이 DB에 없어 admin 404 가 난다.
 */
final class ModuleLayoutSyncCatalog
{
    /**
     * @param  list<string>|null  $limitTo  null = 활성 모듈 전체
     * @return list<string>
     */
    public static function identifiersWithFilesystemLayouts(?array $limitTo = null): array
    {
        $candidates = $limitTo ?? ModuleManager::getActiveModuleIdentifiers();
        $ids = [];

        foreach ($candidates as $identifier) {
            if (self::hasSyncableLayouts((string) $identifier)) {
                $ids[] = (string) $identifier;
            }
        }

        sort($ids);

        return $ids;
    }

    public static function hasSyncableLayouts(string $identifier): bool
    {
        foreach (['admin', 'user'] as $type) {
            $dir = base_path("modules/{$identifier}/resources/layouts/{$type}");
            if (! File::isDirectory($dir)) {
                continue;
            }

            foreach (File::files($dir) as $file) {
                if (str_ends_with($file->getFilename(), '.json')) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @return list<string>
     */
    public static function resolveModuleOption(string $moduleOption, ?array $limitTo = null): array
    {
        if (in_array($moduleOption, ['*', 'all', ''], true)) {
            return self::identifiersWithFilesystemLayouts($limitTo);
        }

        return [$moduleOption];
    }
}
