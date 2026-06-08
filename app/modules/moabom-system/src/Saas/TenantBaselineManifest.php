<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

/**
 * tenant-baseline-manifest.json SSOT 로더.
 */
final class TenantBaselineManifest
{
    private const DEFAULT_PATH = 'modules/moabom-system/database/saas/tenant-baseline-manifest.json';

    /** @var array<string, mixed>|null */
    private static ?array $cached = null;

    /**
     * @return list<string>
     */
    public function baselineDbTables(): array
    {
        return $this->stringList('baseline_db_tables');
    }

    /**
     * @return list<string>
     */
    public function runtimeDbTables(): array
    {
        return $this->stringList('runtime_db_tables');
    }

    /**
     * @return list<string>
     */
    public function baselineGcsPaths(): array
    {
        return $this->stringList('baseline_gcs_paths');
    }

    /**
     * @return list<string>
     */
    public function runtimeGcsPrefixes(): array
    {
        return $this->stringList('runtime_gcs_prefixes');
    }

    public function runtimeGcsModulesExceptSeed(): bool
    {
        return (bool) ($this->load()['runtime_gcs_modules_except_seed'] ?? true);
    }

    /**
     * @return array<string, mixed>
     */
    private function load(): array
    {
        if (self::$cached !== null) {
            return self::$cached;
        }

        $path = base_path(self::DEFAULT_PATH);
        if (! is_file($path)) {
            throw new \RuntimeException("tenant baseline manifest 없음: {$path}");
        }

        $decoded = json_decode((string) file_get_contents($path), true);
        if (! is_array($decoded)) {
            throw new \RuntimeException('tenant baseline manifest JSON 파싱 실패');
        }

        self::$cached = $decoded;

        return self::$cached;
    }

    /**
     * @return list<string>
     */
    private function stringList(string $key): array
    {
        $values = $this->load()[$key] ?? [];
        if (! is_array($values)) {
            return [];
        }

        return array_values(array_filter(array_map('strval', $values)));
    }
}
