<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

/**
 * Package JSON 로더 — modules/moabom-system/database/saas/packages/{id}.json
 */
final class TenantPackageCatalog
{
    public function __construct(
        private readonly ?string $packagesPath = null,
    ) {}

    public function get(string $packageId): TenantPackage
    {
        $packageId = trim($packageId);
        if ($packageId === '' || ! preg_match('/^[a-z0-9][a-z0-9_-]*$/', $packageId)) {
            throw new \InvalidArgumentException("Invalid package id: {$packageId}");
        }

        $path = $this->packagesPath ?? dirname(__DIR__, 2).'/database/saas/packages/'.$packageId.'.json';
        if (! is_file($path)) {
            throw new \InvalidArgumentException("Unknown package: {$packageId}");
        }

        $raw = file_get_contents($path);
        if ($raw === false) {
            throw new \RuntimeException("Cannot read package: {$path}");
        }

        /** @var mixed $decoded */
        $decoded = json_decode($raw, true);
        if (! is_array($decoded)) {
            throw new \RuntimeException("Invalid package JSON: {$path}");
        }

        return TenantPackage::fromArray($decoded);
    }

    /**
     * @return list<string>
     */
    public function listIds(): array
    {
        $dir = $this->packagesPath ?? dirname(__DIR__, 2).'/database/saas/packages';
        if (! is_dir($dir)) {
            return [];
        }

        $ids = [];
        foreach (glob($dir.'/*.json') ?: [] as $file) {
            $ids[] = basename($file, '.json');
        }

        sort($ids);

        return $ids;
    }
}
