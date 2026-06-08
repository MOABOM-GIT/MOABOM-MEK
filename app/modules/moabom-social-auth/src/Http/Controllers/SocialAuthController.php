<?php

namespace Modules\Moabom\Social\Auth\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use Modules\Moabom\Social\Auth\Exceptions\SocialAuthException;
use Modules\Moabom\Social\Auth\Services\SocialAuthBrokerStateService;
use Modules\Moabom\Social\Auth\Http\Requests\CompleteSocialProfileRequest;
use Modules\Moabom\Social\Auth\Http\Requests\ExchangeSocialAuthCodeRequest;
use Modules\Moabom\Social\Auth\Services\SocialAuthService;
use Modules\Moabom\Social\Auth\Services\SocialAuthTenantRuntimeSwitcher;
use Modules\Moabom\System\Saas\TenantHostParser;
use Throwable;

class SocialAuthController extends Controller
{
    private const STATE_SESSION_PREFIX = 'sirsoft_social_auth_state_';

    private const POPUP_SESSION_PREFIX = 'sirsoft_social_auth_popup_';

    public function __construct(
        private readonly SocialAuthService $socialAuthService,
        private readonly SocialAuthBrokerStateService $brokerStateService,
        private readonly SocialAuthTenantRuntimeSwitcher $tenantRuntimeSwitcher,
    ) {}

    /**
     * 지원 provider 목록을 반환합니다.
     */
    public function providers(): JsonResponse
    {
        return ResponseHelper::moduleSuccess('moabom-social-auth', 'messages.providers_success', [
            'providers' => $this->socialAuthService->enabledProviders(),
        ]);
    }

    /**
     * SNS 제공자 인증 페이지로 이동합니다.
     */
    public function redirect(Request $request, string $provider): RedirectResponse
    {
        try {
            if ($this->brokerStateService->isEnabled() && $this->shouldRouteViaBroker($request)) {
                $state = $this->brokerStateService->issueTenantState(
                    $request->getHost(),
                    $provider,
                    $request->boolean('popup')
                );

                return redirect()->away($this->brokerStateService->brokerStartUrl($provider, $state));
            }

            $state = Str::random(40);
            $request->session()->put($this->getStateSessionKey($provider), $state);
            $request->session()->put($this->getPopupSessionKey($provider), $request->boolean('popup'));

            return redirect()->away($this->socialAuthService->getRedirectUrl($provider, $state));
        } catch (SocialAuthException $e) {
            return $this->redirectWithError($e->getMessage(), $request->boolean('popup'), $provider);
        }
    }

    /**
     * SNS 제공자 callback을 처리합니다.
     */
    public function callback(Request $request, string $provider): RedirectResponse
    {
        $isPopup = $this->pullPopupFlow($request, $provider);

        try {
            if ($request->query('error')) {
                $this->validateState($request, $provider);
                $message = (string) ($request->query('error_description') ?: $request->query('error'));
                throw new SocialAuthException($message);
            }

            $this->validateState($request, $provider);

            $code = (string) $request->query('code');
            if ($code === '') {
                throw new SocialAuthException(__('moabom-social-auth::messages.code_required'));
            }

            $result = $this->socialAuthService->handleCallback($provider, $code, (string) $request->query('state'));

            if ($isPopup) {
                return redirect($this->popupCompleteUrl([
                    'status' => 'success',
                    'code' => $result['code'],
                    'provider' => $result['provider'],
                ], $provider));
            }

            return redirect('/?'.http_build_query([
                'social_auth_code' => $result['code'],
                'provider' => $result['provider'],
            ]));
        } catch (\Throwable $e) {
            return $this->redirectWithError($e->getMessage(), $isPopup, $provider);
        }
    }

    /**
     * 중앙 브로커에서 SNS provider 인증 페이지로 이동합니다.
     */
    public function brokerStart(Request $request, string $provider): RedirectResponse
    {
        try {
            $this->assertBrokerRequest($request);
            $state = (string) $request->query('state');
            $this->brokerStateService->parseTenantState($state, $provider);

            return redirect()->away($this->socialAuthService->getRedirectUrl($provider, $state));
        } catch (SocialAuthException $e) {
            return $this->redirectWithError($e->getMessage(), false, $provider);
        }
    }

    /**
     * 중앙 브로커 callback을 처리하고 원래 tenant로 복귀시킵니다.
     */
    public function brokerCallback(Request $request, string $provider): RedirectResponse
    {
        $tenantHost = null;
        $isPopup = false;

        try {
            $this->assertBrokerRequest($request);

            $statePayload = $this->brokerStateService->parseTenantState((string) $request->query('state'), $provider);
            $tenantHost = $statePayload['tenant_host'];
            $isPopup = $statePayload['popup'];

            $this->tenantRuntimeSwitcher->bootstrapOriginByHost($request, $tenantHost);

            if ($request->query('error')) {
                $message = (string) ($request->query('error_description') ?: $request->query('error'));
                throw new SocialAuthException($message);
            }

            $code = (string) $request->query('code');
            if ($code === '') {
                throw new SocialAuthException(__('moabom-social-auth::messages.code_required'));
            }

            $result = $this->socialAuthService->handleCallback($provider, $code, (string) $request->query('state'));

            if ($isPopup) {
                return redirect()->away($this->tenantPopupCompleteUrl($request, $tenantHost, $provider, [
                    'status' => 'success',
                    'code' => $result['code'],
                    'provider' => $result['provider'],
                ]));
            }

            return redirect()->away($this->tenantSuccessUrl($request, $tenantHost, [
                'social_auth_code' => $result['code'],
                'provider' => $result['provider'],
            ]));
        } catch (Throwable $e) {
            if ($tenantHost !== null) {
                if ($isPopup) {
                    return redirect()->away($this->tenantPopupCompleteUrl($request, $tenantHost, $provider, [
                        'status' => 'error',
                        'provider' => $provider,
                        'error' => $e->getMessage(),
                    ]));
                }

                return redirect()->away($this->tenantSuccessUrl($request, $tenantHost, [
                    'social_auth_error' => $e->getMessage(),
                    'provider' => $provider,
                ]));
            }

            return $this->redirectWithError($e->getMessage(), false, $provider);
        }
    }

    /**
     * 팝업 OAuth 완료 결과를 부모 창으로 전달합니다.
     */
    public function popupComplete(Request $request, string $provider): Response|RedirectResponse
    {
        $status = (string) $request->query('status', '');
        if ($status === '') {
            return redirect('/?social_auth_error='.urlencode('invalid_popup_payload'));
        }

        $payload = [
            'type' => 'moabom-social-auth',
            'status' => $status === 'success' ? 'success' : 'error',
            'provider' => $request->query('provider', $provider),
            'code' => $request->query('code'),
            'error' => $request->query('error'),
        ];

        $json = json_encode($payload, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);

        return response(<<<HTML
<!doctype html>
<html lang="ko">
<head>
    <meta charset="utf-8">
    <title>SNS 로그인 처리 중</title>
</head>
<body>
    <script>
        (function () {
            var payload = {$json};
            var targetOrigin = window.location.origin;

            if (!window.opener || window.opener.closed) {
                window.location.replace('/?social_auth_error=' + encodeURIComponent(payload.error || 'popup_opener_not_found'));
                return;
            }

            window.opener.postMessage(payload, targetOrigin);

            setTimeout(function () {
                window.close();
            }, 100);
        })();
    </script>
    <p>SNS 로그인 처리가 완료되었습니다. 창이 자동으로 닫히지 않으면 닫아주세요.</p>
</body>
</html>
HTML, 200)->header('Content-Type', 'text/html; charset=UTF-8');
    }

    /**
     * 프론트 교환 코드로 Sanctum 토큰을 발급합니다.
     */
    public function exchange(ExchangeSocialAuthCodeRequest $request): JsonResponse
    {
        try {
            $data = $this->socialAuthService->exchangeCode($request->validated()['code']);
            if (isset($data['user'])) {
                $data['user'] = new UserResource($data['user']);
            }

            return ResponseHelper::moduleSuccess('moabom-social-auth', 'messages.exchange_success', $data);
        } catch (SocialAuthException $e) {
            return ResponseHelper::moduleError('moabom-social-auth', 'messages.exchange_failed', 422, [
                'code' => [$e->getMessage()],
            ]);
        }
    }

    /**
     * SNS 신규 가입자의 프로필 보완을 처리하고 토큰을 발급합니다.
     */
    public function completeProfile(CompleteSocialProfileRequest $request): JsonResponse
    {
        try {
            $validated = $request->validated();
            $data = $this->socialAuthService->completeProfile($validated['code'], $validated);
            $data['user'] = new UserResource($data['user']);

            return ResponseHelper::moduleSuccess('moabom-social-auth', 'messages.exchange_success', $data);
        } catch (SocialAuthException $e) {
            return ResponseHelper::moduleError('moabom-social-auth', 'messages.exchange_failed', 422, [
                'code' => [$e->getMessage()],
            ]);
        }
    }

    /**
     * state 세션 키를 반환합니다.
     */
    private function getStateSessionKey(string $provider): string
    {
        return self::STATE_SESSION_PREFIX.$provider;
    }

    /**
     * 팝업 플로우 세션 키를 반환합니다.
     */
    private function getPopupSessionKey(string $provider): string
    {
        return self::POPUP_SESSION_PREFIX.$provider;
    }

    /**
     * 팝업 플로우 여부를 한 번만 조회합니다.
     */
    private function pullPopupFlow(Request $request, string $provider): bool
    {
        return (bool) $request->session()->pull($this->getPopupSessionKey($provider), false);
    }

    /**
     * OAuth state 값을 검증합니다.
     */
    private function validateState(Request $request, string $provider): void
    {
        $key = $this->getStateSessionKey($provider);
        $expected = $request->session()->pull($key);
        $actual = $request->query('state');

        if (! $expected || ! $actual || ! hash_equals((string) $expected, (string) $actual)) {
            throw new SocialAuthException(__('moabom-social-auth::messages.invalid_state'));
        }
    }

    /**
     * 에러 정보를 포함해 로그인 화면으로 돌려보냅니다.
     */
    private function redirectWithError(string $message, bool $isPopup = false, ?string $provider = null): RedirectResponse
    {
        if ($isPopup && $provider) {
            return redirect($this->popupCompleteUrl([
                'status' => 'error',
                'provider' => $provider,
                'error' => $message,
            ], $provider));
        }

        return redirect('/login?'.http_build_query([
            'social_auth_error' => $message,
        ]));
    }

    /**
     * 팝업 완료 페이지 URL을 생성합니다.
     *
     * @param  array<string, string|null>  $query
     */
    private function popupCompleteUrl(array $query, string $provider): string
    {
        return "/api/modules/moabom-social-auth/{$provider}/popup-complete?".http_build_query($query);
    }

    /**
     * 중앙 브로커 요청인지 확인합니다.
     */
    private function assertBrokerRequest(Request $request): void
    {
        if (! $this->brokerStateService->isEnabled()) {
            throw new SocialAuthException(__('moabom-social-auth::messages.broker_disabled'));
        }

        if (strtolower($request->getHost()) !== $this->brokerStateService->brokerHost()) {
            throw new SocialAuthException(__('moabom-social-auth::messages.broker_host_mismatch'));
        }
    }

    private function shouldRouteViaBroker(Request $request): bool
    {
        $host = strtolower($request->getHost());
        if ($host === '' || $host === $this->brokerStateService->brokerHost()) {
            return false;
        }

        $parser = new TenantHostParser(
            (string) config('moabom-system.saas.base_domain', 'mek360.com'),
            (array) config('moabom-system.saas.platform_hosts', []),
        );
        $parsed = $parser->parse($host);

        return in_array($parsed['type'], ['tenant', 'platform'], true);
    }

    private function isTenantHostRequest(Request $request): bool
    {
        $parser = new TenantHostParser(
            (string) config('moabom-system.saas.base_domain', 'mek360.com'),
            (array) config('moabom-system.saas.platform_hosts', []),
        );
        $parsed = $parser->parse($request->getHost());

        return $parsed['type'] === 'tenant';
    }

    /**
     * @param  array<string, string|null>  $query
     */
    private function tenantPopupCompleteUrl(Request $request, string $tenantHost, string $provider, array $query): string
    {
        return $this->tenantBaseUrl($request, $tenantHost)
            ."/api/modules/moabom-social-auth/{$provider}/popup-complete?"
            .http_build_query($query);
    }

    /**
     * @param  array<string, string|null>  $query
     */
    private function tenantSuccessUrl(Request $request, string $tenantHost, array $query): string
    {
        return $this->tenantBaseUrl($request, $tenantHost).'/?'.http_build_query($query);
    }

    private function tenantBaseUrl(Request $request, string $tenantHost): string
    {
        $scheme = $request->isSecure() ? 'https' : (app()->environment('local') ? 'http' : 'https');

        return "{$scheme}://{$tenantHost}";
    }
}
