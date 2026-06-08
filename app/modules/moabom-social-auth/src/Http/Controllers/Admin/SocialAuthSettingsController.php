<?php

namespace Modules\Moabom\Social\Auth\Http\Controllers\Admin;

use App\Helpers\PermissionHelper;
use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AdminBaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Moabom\Social\Auth\Http\Requests\Admin\StoreSocialAuthSettingsRequest;
use Modules\Moabom\Social\Auth\Services\SocialAuthBrokerStateService;
use Modules\Moabom\Social\Auth\Services\SocialAuthSettingsService;
use Modules\Moabom\Social\Auth\Support\SocialAuthAdminHostScope;
use Modules\Moabom\Social\Auth\Support\SocialAuthCallback;

class SocialAuthSettingsController extends AdminBaseController
{
    public function __construct(
        private readonly SocialAuthSettingsService $settingsService,
        private readonly SocialAuthBrokerStateService $brokerStateService,
    ) {}

    /**
     * SNS 로그인 설정을 조회합니다.
     */
    public function index(Request $request): JsonResponse
    {
        return ResponseHelper::moduleSuccess(
            'moabom-social-auth',
            'messages.settings.fetch_success',
            array_merge($this->settingsService->getAllSettings(), [
                'callback_urls' => $this->providerCallbackUrls(),
                'abilities' => $this->settingsAbilities($request),
            ])
        );
    }

    /**
     * SNS 로그인 설정을 저장합니다.
     */
    public function store(StoreSocialAuthSettingsRequest $request): JsonResponse
    {
        $result = $this->settingsService->saveSettings($request->validatedSettings());

        if (! $result) {
            return ResponseHelper::moduleError(
                'moabom-social-auth',
                'messages.settings.save_failed',
                400,
                [
                    'reason' => $this->settingsService->getLastError(),
                ]
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-social-auth',
            'messages.settings.save_success',
            array_merge($this->settingsService->getAllSettings(), [
                'callback_urls' => $this->providerCallbackUrls(),
                'abilities' => $this->settingsAbilities($request),
            ])
        );
    }

    /**
     * 설정 캐시를 초기화합니다.
     */
    public function clearCache(): JsonResponse
    {
        $this->settingsService->clearCache();

        return ResponseHelper::moduleSuccess(
            'moabom-social-auth',
            'messages.settings.clear_cache_success',
            ['cleared' => true]
        );
    }

    /**
     * Provider 콘솔에 등록할 Callback/Redirect URI를 반환합니다.
     *
     * OAuth에 사용하는 기본 redirect와 동일하게 `url()`(APP_URL) 기준으로 생성한다.
     *
     * @return array<string, string>
     */
    private function providerCallbackUrls(): array
    {
        if ($this->brokerStateService->isEnabled()) {
            return [
                'google' => $this->brokerStateService->brokerCallbackAbsoluteUrl('google'),
                'kakao' => $this->brokerStateService->brokerCallbackAbsoluteUrl('kakao'),
                'naver' => $this->brokerStateService->brokerCallbackAbsoluteUrl('naver'),
            ];
        }

        return SocialAuthCallback::allAbsoluteUrls();
    }

    /**
     * @return array<string, mixed>
     */
    private function settingsAbilities(Request $request): array
    {
        $scope = SocialAuthAdminHostScope::resolve(
            $this->settingsService->isSubTenantHostRequest()
        );

        return array_merge($scope, [
            'can_update' => PermissionHelper::check('moabom-social-auth.settings.update', $request->user()),
        ]);
    }
}
