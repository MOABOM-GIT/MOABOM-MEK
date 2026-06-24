<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Support;

use Modules\Moabom\System\Saas\MoabomModuleCategoryDbStore;

/**
 * SaaS 운영에서 모듈 카테고리 JSON 을 ephemeral local storage 대신 DB+GCS mirror 로 유지.
 */
trait MoabomSaasPersistentModuleSettings
{
    abstract protected function getPersistentModuleIdentifier(): string;

    protected function usesPersistentModuleSettingsStore(): bool
    {
        return MoabomModuleCategoryDbStore::shouldUseInProduction();
    }

    /**
     * @param  callable(): array<string, mixed>  $loadLegacy
     * @return array<string, mixed>
     */
    protected function resolveCategorySettings(string $category, callable $loadLegacy): array
    {
        if (! $this->usesPersistentModuleSettingsStore()) {
            return $loadLegacy();
        }

        $stored = $this->persistentModuleStore()->read($category);
        if ($stored !== [] || $this->persistentModuleStore()->exists($category)) {
            return $stored;
        }

        $legacy = $loadLegacy();
        if ($legacy !== []) {
            $this->persistentModuleStore()->replace($category, $legacy);
        }

        return $legacy;
    }

    /**
     * @param  callable(): bool  $saveLegacy
     */
    protected function persistCategorySettings(string $category, array $settings, callable $saveLegacy): bool
    {
        if ($this->usesPersistentModuleSettingsStore()) {
            return $this->persistentModuleStore()->replace($category, $settings);
        }

        return $saveLegacy();
    }

    private function persistentModuleStore(): MoabomModuleCategoryDbStore
    {
        return new MoabomModuleCategoryDbStore($this->getPersistentModuleIdentifier());
    }
}
