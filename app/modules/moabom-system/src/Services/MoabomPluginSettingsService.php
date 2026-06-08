<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Services;

use App\Contracts\Repositories\PluginRepositoryInterface;
use App\Enums\ExtensionStatus;
use App\Extension\PluginManager;
use App\Extension\TemplateManager;
use App\Services\LayoutService;
use App\Services\PluginSettingsService;

/**
 * 부트 페이로드용 `getAllActiveSettings()` 에서 DB 비활성 플러그인을 제외한다.
 */
class MoabomPluginSettingsService extends PluginSettingsService
{
    public function __construct(
        PluginManager $pluginManager,
        TemplateManager $templateManager,
        LayoutService $layoutService,
        private PluginRepositoryInterface $pluginRepository,
    ) {
        parent::__construct($pluginManager, $templateManager, $layoutService);
    }

    /**
     * {@inheritdoc}
     */
    public function getAllActiveSettings(): array
    {
        $result = parent::getAllActiveSettings();

        foreach (array_keys($result) as $identifier) {
            if (! is_string($identifier) || $identifier === '') {
                continue;
            }
            $record = $this->pluginRepository->findByIdentifier($identifier);
            if ($record !== null && $record->status !== ExtensionStatus::Active->value) {
                unset($result[$identifier]);
            }
        }

        return $result;
    }
}
