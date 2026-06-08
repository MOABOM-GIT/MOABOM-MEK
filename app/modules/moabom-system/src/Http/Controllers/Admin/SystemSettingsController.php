<?php

namespace Modules\Moabom\System\Http\Controllers\Admin;

use App\Helpers\PermissionHelper;
use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AdminBaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Moabom\System\Experience\TenantSettingsWriter;
use Modules\Moabom\System\Http\Requests\Admin\StoreSystemSettingsRequest;
use Modules\Moabom\System\Services\SystemSettingsService;

class SystemSettingsController extends AdminBaseController
{
    public function __construct(
        private readonly SystemSettingsService $settingsService,
        private readonly TenantSettingsWriter $tenantSettingsWriter,
    ) {}

    /**
     * 마이페이지 설정을 조회합니다.
     */
    public function index(Request $request): JsonResponse
    {
        return ResponseHelper::moduleSuccess(
            'moabom-system',
            'messages.settings.fetch_success',
            array_merge($this->settingsService->getAllSettings(), [
                'abilities' => [
                    'can_update' => PermissionHelper::check('moabom-system.settings.update', $request->user()),
                ],
            ])
        );
    }

    /**
     * 마이페이지 설정을 저장합니다.
     */
    public function store(StoreSystemSettingsRequest $request): JsonResponse
    {
        $validated = $request->validatedSettings();

        // SaaS: appearance는 saveSettings()에서 스킵됨 — TenantSettingsWriter(replaceSettings) 필수
        $result = config('moabom-system.saas.enabled', false)
            ? $this->tenantSettingsWriter->write($validated)
            : $this->settingsService->saveSettings($validated);

        if (! $result) {
            return ResponseHelper::moduleError(
                'moabom-system',
                'messages.settings.save_failed',
                400
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-system',
            'messages.settings.save_success',
            $this->settingsService->getAllSettings()
        );
    }

    /**
     * 설정 캐시를 초기화합니다.
     */
    public function clearCache(): JsonResponse
    {
        $this->settingsService->clearCache();

        return ResponseHelper::moduleSuccess(
            'moabom-system',
            'messages.settings.clear_cache_success',
            ['cleared' => true]
        );
    }
}
