<?php

namespace Modules\Moabom\Credit\Http\Controllers\Admin;

use App\Helpers\PermissionHelper;
use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AdminBaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Moabom\Credit\Http\Requests\Admin\StoreCreditSettingsRequest;
use Modules\Moabom\Credit\Services\CreditSettingsService;

class CreditSettingsController extends AdminBaseController
{
    public function __construct(
        private readonly CreditSettingsService $settingsService,
    ) {}

    /**
     * 크레딧 설정을 조회합니다.
     */
    public function index(Request $request): JsonResponse
    {
        return ResponseHelper::moduleSuccess(
            'moabom-credit',
            'messages.settings.fetch_success',
            array_merge($this->settingsService->getAllSettings(), [
                'abilities' => [
                    'can_update' => PermissionHelper::check('moabom-credit.settings.update', $request->user()),
                ],
            ])
        );
    }

    /**
     * 크레딧 설정을 저장합니다.
     */
    public function store(StoreCreditSettingsRequest $request): JsonResponse
    {
        $result = $this->settingsService->saveSettings($request->validatedSettings());

        if (! $result) {
            return ResponseHelper::moduleError(
                'moabom-credit',
                'messages.settings.save_failed',
                400
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-credit',
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
            'moabom-credit',
            'messages.settings.clear_cache_success',
            ['cleared' => true]
        );
    }
}
