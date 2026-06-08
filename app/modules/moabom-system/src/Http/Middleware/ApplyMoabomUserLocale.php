<?php

namespace Modules\Moabom\System\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\PersonalAccessToken;
use Modules\Moabom\System\Models\UserSystemSetting;
use Modules\Moabom\System\Support\MoabomUiLocales;
use Symfony\Component\HttpFoundation\Response;

/**
 * 인증된 사용자의 Moabom 사용자 설정(preferences.language)을 Laravel 로케일에 반영합니다.
 *
 * 코어 SetLocale 미들웨어는 config(app.supported_locales)만 허용하므로,
 * ja/zh 등 Moabom 전용 언어는 본 미들웨어에서 후속으로 적용합니다.
 *
 * 프론트 전용 ja/zh 는 사용자 템플릿 JSON(`/api/templates/.../lang/ja|zh.json`)으로 표시하고,
 * Laravel __('…')·관리자 API 축은 영문을 유지하기 위해 App 로케일은 en 으로 둡니다.
 */
class ApplyMoabomUserLocale
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $this->resolveUser($request);
        if ($user !== null) {
            $setting = UserSystemSetting::query()
                ->where('user_id', $user->id)
                ->first();
            $language = Arr::get($setting?->settings, 'preferences.language');
            if (is_string($language) && MoabomUiLocales::isAllowed($language)) {
                App::setLocale(MoabomUiLocales::toAppLocale($language));
            }
        }

        return $next($request);
    }

    private function resolveUser(Request $request): ?User
    {
        if (Auth::check()) {
            $user = Auth::user();

            return $user instanceof User ? $user : null;
        }

        $bearerToken = $request->bearerToken();
        if ($bearerToken !== null && $bearerToken !== '') {
            $token = PersonalAccessToken::findToken($bearerToken);
            if ($token !== null && $token->tokenable instanceof User) {
                return $token->tokenable;
            }
        }

        return null;
    }
}
