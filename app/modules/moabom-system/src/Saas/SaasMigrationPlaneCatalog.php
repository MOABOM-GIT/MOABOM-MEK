<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

/**
 * G7 코어·모듈·플러그인 migration plane 목록 (배포 schema-sync SSOT).
 *
 * path 는 artisan migrate --path 기준 (base_path 상대, 보통 app/ 가 cwd).
 */
final class SaasMigrationPlaneCatalog
{
    /**
     * @return list<array{key: string, path: string, kind: 'core'|'module'|'plugin'}>
     */
    public function discover(): array
    {
        $planes = [];

        $corePath = 'database/migrations';
        if (is_dir(base_path($corePath))) {
            $planes[] = ['key' => 'core', 'path' => $corePath, 'kind' => 'core'];
        }

        foreach ($this->topLevelMigrationDirs(base_path('modules')) as $moduleId => $absolute) {
            $rel = 'modules/'.$moduleId.'/database/migrations';
            if ($this->hasTopLevelPhpMigrations($absolute)) {
                $planes[] = ['key' => 'module:'.$moduleId, 'path' => $rel, 'kind' => 'module'];
            }
        }

        foreach ($this->topLevelMigrationDirs(base_path('plugins')) as $pluginId => $absolute) {
            $rel = 'plugins/'.$pluginId.'/database/migrations';
            if ($this->hasTopLevelPhpMigrations($absolute)) {
                $planes[] = ['key' => 'plugin:'.$pluginId, 'path' => $rel, 'kind' => 'plugin'];
            }
        }

        return $planes;
    }

    /**
     * @return array<string, string> id => absolute migrations dir
     */
    private function topLevelMigrationDirs(string $root): array
    {
        if (! is_dir($root)) {
            return [];
        }

        $out = [];
        foreach (scandir($root) ?: [] as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            $mig = $root.DIRECTORY_SEPARATOR.$entry.DIRECTORY_SEPARATOR.'database'.DIRECTORY_SEPARATOR.'migrations';
            if (is_dir($mig)) {
                $out[$entry] = $mig;
            }
        }
        ksort($out);

        return $out;
    }

    private function hasTopLevelPhpMigrations(string $absoluteDir): bool
    {
        foreach (glob($absoluteDir.DIRECTORY_SEPARATOR.'*.php') ?: [] as $_file) {
            return true;
        }

        return false;
    }
}
