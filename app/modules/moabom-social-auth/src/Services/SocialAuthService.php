<?php

namespace Modules\Moabom\Social\Auth\Services;

use App\Contracts\Repositories\RoleRepositoryInterface;
use App\Contracts\Repositories\UserRepositoryInterface;
use App\Enums\UserStatus;
use App\Extension\HookManager;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Modules\Moabom\Social\Auth\DataTransferObjects\SocialProviderUser;
use Modules\Moabom\Social\Auth\Exceptions\SocialAuthException;
use Modules\Moabom\Social\Auth\Models\SocialAuthCode;
use Modules\Moabom\Social\Auth\Repositories\Contracts\SocialAccountRepositoryInterface;
use Modules\Moabom\Social\Auth\Repositories\Contracts\SocialAuthCodeRepositoryInterface;

class SocialAuthService
{
    private const SYNTHETIC_EMAIL_DOMAIN = 'social-auth.invalid';

    public function __construct(
        private readonly SocialProviderService $providerService,
        private readonly SocialAccountRepositoryInterface $socialAccountRepository,
        private readonly SocialAuthCodeRepositoryInterface $authCodeRepository,
        private readonly UserRepositoryInterface $userRepository,
        private readonly RoleRepositoryInterface $roleRepository,
    ) {}

    /**
     * SNS 인가 URL을 생성합니다.
     */
    public function getRedirectUrl(string $provider, string $state): string
    {
        return $this->providerService->getAuthorizationUrl($provider, $state);
    }

    /**
     * 활성화된 SNS 제공자 목록을 반환합니다.
     *
     * @return array<int, string>
     */
    public function enabledProviders(): array
    {
        return $this->providerService->enabledProviders();
    }

    /**
     * OAuth callback 코드로 사용자 연결 후 프론트 교환 코드를 생성합니다.
     *
     * @return array{code: string, provider: string, user: User, requires_profile_completion: bool}
     */
    public function handleCallback(string $provider, string $code, string $state): array
    {
        $providerUser = $this->providerService->fetchUser($provider, $code, $state);
        $result = $this->resolveUser($providerUser);
        $user = $result['user'];

        $plainCode = Str::random(64);
        $this->authCodeRepository->deleteExpired();
        $this->authCodeRepository->create(
            $user,
            $provider,
            $plainCode,
            now()->addMinutes(5),
            $result['is_new_user']
        );

        return [
            'code' => $plainCode,
            'provider' => $provider,
            'user' => $user,
            'requires_profile_completion' => $result['is_new_user'],
        ];
    }

    /**
     * 프론트가 전달한 일회용 코드로 Sanctum 토큰을 발급합니다.
     *
     * @return array<string, mixed>
     */
    public function exchangeCode(string $plainCode): array
    {
        $authCode = $this->authCodeRepository->findUsableByPlainCode($plainCode);
        if (! $authCode) {
            throw new SocialAuthException(__('moabom-social-auth::messages.invalid_code'));
        }

        if ($authCode->requires_profile_completion && ! $authCode->profile_completed_at) {
            return $this->completeProfile($plainCode, []);
        }

        return $this->issueToken($authCode);
    }

    /**
     * SNS 프로필 보완 정보를 저장한 뒤 토큰을 발급합니다.
     *
     * @param  array<string, mixed>  $profileData
     * @return array<string, mixed>
     */
    public function completeProfile(string $plainCode, array $profileData): array
    {
        $authCode = $this->authCodeRepository->findUsableByPlainCode($plainCode);
        if (! $authCode || ! $authCode->requires_profile_completion) {
            throw new SocialAuthException(__('moabom-social-auth::messages.invalid_code'));
        }

        /** @var User $user */
        $user = $authCode->user;
        $updates = $this->profileUpdates($user, $profileData);

        if ($updates !== []) {
            $user->forceFill($updates)->save();
        }

        $this->authCodeRepository->markProfileCompleted($authCode);
        $authCode->refresh();

        return $this->issueToken($authCode);
    }

    /**
     * SNS 계정에 연결할 사용자를 조회하거나 생성합니다.
     *
     * @return array{user: User, is_new_user: bool}
     */
    private function resolveUser(SocialProviderUser $providerUser): array
    {
        return DB::transaction(function () use ($providerUser): array {
            $socialAccount = $this->socialAccountRepository->findByProviderUser(
                $providerUser->provider,
                $providerUser->providerUserId
            );

            $user = $socialAccount?->user;
            $isNewUser = false;

            if (! $user && $providerUser->email) {
                $user = $this->userRepository->findByEmail($providerUser->email);
            }

            if (! $user) {
                $user = $this->createUser($providerUser);
                $isNewUser = true;
            } elseif ($providerUser->email && $this->isSyntheticEmail((string) $user->email)) {
                $existingEmailUser = $this->userRepository->findByEmail($providerUser->email);
                if (! $existingEmailUser || $existingEmailUser->is($user)) {
                    $user->forceFill(['email' => $providerUser->email])->save();
                }
            }

            if ($user->status !== UserStatus::Active->value) {
                throw new SocialAuthException(__('moabom-social-auth::messages.inactive_user'));
            }

            $this->socialAccountRepository->updateOrCreateForUser(
                $user,
                $providerUser->provider,
                $providerUser->providerUserId,
                [
                    'email' => $providerUser->email,
                    'name' => $providerUser->name,
                    'nickname' => $providerUser->nickname,
                    'avatar' => $providerUser->avatar,
                    'access_token' => $providerUser->accessToken,
                    'refresh_token' => $providerUser->refreshToken,
                    'token_expires_at' => $providerUser->tokenExpiresAt,
                    'linked_at' => now(),
                ]
            );

            HookManager::doAction('moabom-social-auth.after_link', $user, [
                'provider' => $providerUser->provider,
                'is_new_user' => $isNewUser,
            ]);

            return [
                'user' => $user,
                'is_new_user' => $isNewUser,
            ];
        });
    }

    /**
     * SNS 프로필 기반 신규 사용자를 생성합니다.
     */
    private function createUser(SocialProviderUser $providerUser): User
    {
        $displayName = $providerUser->name ?: ($providerUser->nickname ?: "{$providerUser->provider} 사용자");
        $email = $providerUser->email ?: $this->makeSyntheticEmail($providerUser);

        $user = $this->userRepository->create([
            'name' => $displayName,
            'nickname' => $providerUser->nickname,
            'email' => $email,
            'password' => Hash::make(Str::random(48)),
            'language' => request()->getPreferredLanguage(config('app.supported_locales', ['ko', 'en'])) ?? 'ko',
            'status' => UserStatus::Active->value,
            'ip_address' => request()->ip(),
        ]);

        $userRole = $this->roleRepository->findByIdentifier('user');
        if ($userRole) {
            $user->roles()->syncWithoutDetaching([
                $userRole->id => [
                    'assigned_at' => now(),
                ],
            ]);
        }

        HookManager::doAction('core.auth.after_register', $user, [
            'provider' => $providerUser->provider,
            'registration_time' => now(),
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);

        return $user;
    }

    /**
     * 이메일 권한이 없는 SNS 계정을 위한 내부용 이메일을 생성합니다.
     */
    private function makeSyntheticEmail(SocialProviderUser $providerUser): string
    {
        $hash = hash('sha256', $providerUser->provider.'|'.$providerUser->providerUserId);

        return "{$providerUser->provider}-{$hash}@".self::SYNTHETIC_EMAIL_DOMAIN;
    }

    /**
     * SNS 내부용 임시 이메일인지 확인합니다.
     */
    private function isSyntheticEmail(string $email): bool
    {
        return str_ends_with($email, '@'.self::SYNTHETIC_EMAIL_DOMAIN);
    }

    /**
     * 입력된 프로필 보완값 중 저장할 값만 추출합니다.
     *
     * @param  array<string, mixed>  $profileData
     * @return array<string, string>
     */
    private function profileUpdates(User $user, array $profileData): array
    {
        $updates = [];
        foreach (['name', 'nickname', 'mobile'] as $field) {
            $value = trim((string) Arr::get($profileData, $field, ''));
            if ($value !== '') {
                $updates[$field] = $value;
            }
        }

        $email = trim((string) Arr::get($profileData, 'email', ''));
        if ($email !== '' && ($this->isSyntheticEmail((string) $user->email) || $email !== $user->email)) {
            $updates['email'] = $email;
        }

        return $updates;
    }

    /**
     * 교환 코드를 사용 처리하고 Sanctum 토큰을 발급합니다.
     *
     * @return array{requires_profile_completion: bool, user: User, token: string, token_type: string}
     */
    private function issueToken(SocialAuthCode $authCode): array
    {
        $this->authCodeRepository->markUsed($authCode);

        /** @var User $user */
        $user = $authCode->user;
        $user->forceFill(['last_login_at' => now()])->save();

        HookManager::doAction('core.auth.after_login', $user, [
            'provider' => $authCode->provider,
            'login_time' => now(),
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);

        return [
            'requires_profile_completion' => false,
            'user' => $user,
            'token' => $user->createToken('auth-token', ['*'], $this->getTokenExpiresAt())->plainTextToken,
            'token_type' => 'Bearer',
        ];
    }

    /**
     * 토큰 유지시간 기반 만료 시간을 계산합니다.
     */
    private function getTokenExpiresAt(): ?\DateTimeInterface
    {
        $lifetime = (int) g7_core_settings('security.auth_token_lifetime', 30);

        return $lifetime === 0 ? null : now()->addMinutes($lifetime);
    }
}
