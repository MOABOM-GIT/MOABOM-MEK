<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Services;

use App\Contracts\Repositories\ModuleRepositoryInterface;
use App\Enums\ExtensionStatus;
use App\Extension\ModuleManager;
use App\Extension\TemplateManager;
use App\Services\LayoutService;
use App\Services\ModuleSettingsService;

/**
 * 부트 페이로드용 `getAllActiveSettings()` 에서 DB 비활성 모듈을 제외한다(매니저·캐시 불일치 보정).
 */
class MoabomModuleSettingsService extends ModuleSettingsService
{
    public function __construct(
        ModuleManager $moduleManager,
        TemplateManager $templateManager,
        LayoutService $layoutService,
        private ModuleRepositoryInterface $moduleRepository,
    ) {
        parent::__construct($moduleManager, $templateManager, $layoutService);
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
            $record = $this->moduleRepository->findByIdentifier($identifier);
            if ($record !== null && $record->status !== ExtensionStatus::Active->value) {
                unset($result[$identifier]);
            }
        }

        return $result;
    }
}
