<?php

namespace Modules\Moabom\System\Http\Controllers;

use App\Extension\HookManager;
use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\App;
use Modules\Moabom\System\Experience\TenantExperienceDefaultsReader;
use Modules\Moabom\System\Http\Requests\StoreUserSystemSettingsRequest;
use Modules\Moabom\System\Models\UserSystemSetting;
use Modules\Moabom\System\Support\MoabomUiLocales;

class UserSystemSettingsController extends AuthBaseController
{
    public function __construct(
        private readonly TenantExperienceDefaultsReader $defaultsReader,
    ) {
        parent::__construct();
    }

    /**
     * 사용자 시스템 설정을 조회합니다.
     */
    public function show(): JsonResponse
    {
        $user = $this->getCurrentUser();

        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $settings = $this->getUserSettings($user->id);
        $this->applyMoabomUiLocaleFromSettings($settings);

        return ResponseHelper::moduleSuccess(
            'moabom-system',
            'messages.user.fetch_success',
            $this->enrichResponseData([
                'defaults' => $this->defaultsReader->frontendDefaults(),
                'settings' => $settings,
                'defaults_revision' => $this->defaultsReader->combinedRevision(),
                'site' => $this->defaultsReader->siteMeta(),
                'locale_catalog' => MoabomUiLocales::catalog(),
            ], $user),
        );
    }

    /**
     * 사용자 시스템 설정을 저장합니다.
     */
    public function store(StoreUserSystemSettingsRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();

        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $current = $this->getUserSettings($user->id);
        $next = array_replace_recursive($current, $request->validated());

        UserSystemSetting::query()->updateOrCreate(
            ['user_id' => $user->id],
            ['settings' => $next]
        );

        $this->applyMoabomUiLocaleFromSettings($next);

        return ResponseHelper::moduleSuccess(
            'moabom-system',
            'messages.user.save_success',
            $this->enrichResponseData([
                'defaults' => $this->defaultsReader->frontendDefaults(),
                'settings' => $next,
                'defaults_revision' => $this->defaultsReader->combinedRevision(),
                'site' => $this->defaultsReader->siteMeta(),
                'locale_catalog' => MoabomUiLocales::catalog(),
            ], $user),
        );
    }

    /**
     * 사용자별 설정을 조회합니다.
     *
     * @return array<string, mixed>
     */
    private function getUserSettings(int $userId): array
    {
        $setting = UserSystemSetting::query()
            ->where('user_id', $userId)
            ->first();

        return Arr::wrap($setting?->settings);
    }

    /**
     * 응답 메시지 번역에 사용할 로케일을 Moabom 사용자 설정과 맞춥니다.
     *
     * @param  array<string, mixed>  $settings
     */
    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function enrichResponseData(array $data, object $user): array
    {
        $enriched = HookManager::applyFilters('moabom.user_settings.response_data', $data, $user);

        return is_array($enriched) ? $enriched : $data;
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private function applyMoabomUiLocaleFromSettings(array $settings): void
    {
        $language = Arr::get($settings, 'preferences.language');
        if (is_string($language) && MoabomUiLocales::isAllowed($language)) {
            App::setLocale(MoabomUiLocales::toAppLocale($language));
        }
    }
}
