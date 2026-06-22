<?php

namespace Modules\Moabom\Social\Auth\Providers;

use App\Extension\BaseModuleServiceProvider;
use App\Extension\HookManager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Social\Auth\Services\SocialAuthService;
use Modules\Moabom\Social\Auth\Console\Commands\DiagnoseSocialAuthSettingsCommand;
use Modules\Moabom\Social\Auth\Console\Commands\EnsureSocialAuthDefaultsCommand;
use Modules\Moabom\Social\Auth\Console\Commands\SeedPlatformSocialAuthMasterCommand;
use Modules\Moabom\Social\Auth\Contracts\SocialSettingsServiceInterface;
use Modules\Moabom\Social\Auth\Models\SocialAccount;
use Modules\Moabom\Social\Auth\Repositories\Contracts\SocialAccountRepositoryInterface;
use Modules\Moabom\Social\Auth\Repositories\Contracts\SocialAuthCodeRepositoryInterface;
use Modules\Moabom\Social\Auth\Repositories\SocialAccountRepository;
use Modules\Moabom\Social\Auth\Repositories\SocialAuthCodeRepository;
use Modules\Moabom\Social\Auth\Services\SocialAuthSettingsService;
use Modules\Moabom\Social\Auth\Services\TenantSocialAuthDatabaseSeeder;
use Throwable;

class SocialAuthServiceProvider extends BaseModuleServiceProvider
{
    /**
     * 모듈 식별자
     */
    protected string $moduleIdentifier = 'moabom-social-auth';

    /**
     * Repository 인터페이스와 구현체 매핑
     *
     * @var array<class-string, class-string>
     */
    protected array $repositories = [
        SocialAccountRepositoryInterface::class => SocialAccountRepository::class,
        SocialAuthCodeRepositoryInterface::class => SocialAuthCodeRepository::class,
    ];

    /**
     * @var array<int, class-string>
     */
    protected array $commands = [
        DiagnoseSocialAuthSettingsCommand::class,
        EnsureSocialAuthDefaultsCommand::class,
        SeedPlatformSocialAuthMasterCommand::class,
    ];

    /**
     * 서비스 바인딩을 등록합니다.
     */
    public function register(): void
    {
        parent::register();

        // 코어 설정 로더가 moabom-social-auth 식별자를 추론할 때 찾는 키와 명시적으로 연결합니다.
        $this->app->bind(
            SocialSettingsServiceInterface::class,
            SocialAuthSettingsService::class
        );

        $this->app->singleton(TenantSocialAuthDatabaseSeeder::class);
    }

    /**
     * 모듈 부팅 시 사용자 프로필 응답 확장 훅을 등록합니다.
     */
    public function boot(): void
    {
        parent::boot();

        if ($this->app->runningInConsole()) {
            $this->commands($this->commands);
        }

        // shell-boot social_providers[] — moabom-system 이 moabom-social-auth 를 직접 의존하지 않도록
        HookManager::addFilter(
            'moabom.shell_boot.social_providers',
            function ($providers): array {
                $providers = is_array($providers) ? $providers : [];

                return app(SocialAuthService::class)->enabledProviders();
            },
        );

        HookManager::addFilter(
            'moabom.public_api.cache_fragment.social_providers',
            function (string $default): string {
                if (! Schema::hasTable('social_auth_settings')) {
                    return $default;
                }

                try {
                    $maxUpdatedAt = DB::table('social_auth_settings')->max('updated_at');
                } catch (Throwable) {
                    return $default;
                }

                if ($maxUpdatedAt === null) {
                    return $default;
                }

                $revision = is_string($maxUpdatedAt) ? $maxUpdatedAt : (string) $maxUpdatedAt;
                $scope = preg_replace('/:social:.*$/', '', $default) ?: $default;

                return $scope.':social:'.$revision;
            },
        );

        HookManager::addFilter('core.user.filter_resource_data', function (array $data, $user): array {
            if (! $user?->id || ! Schema::hasTable('social_accounts')) {
                return $data;
            }

            try {
                $provider = SocialAccount::query()
                    ->where('user_id', $user->id)
                    ->orderByDesc('linked_at')
                    ->value('provider');

                $data['social_provider'] = $provider;
                $data['is_social_account'] = $provider !== null;
            } catch (Throwable) {
                return $data;
            }

            return $data;
        });
    }
}
