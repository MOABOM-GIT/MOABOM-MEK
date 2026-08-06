<?php

namespace Modules\Moabom\Credit\Providers;

use App\Extension\BaseModuleServiceProvider;
use App\Extension\HookManager;
use Modules\Moabom\Credit\Contracts\CreditRepositoryInterface;
use Modules\Moabom\Credit\Contracts\CreditSettingsServiceInterface;
use Modules\Moabom\Credit\Repositories\CreditRepository;
use Modules\Moabom\Credit\Services\CreditLevelService;
use Modules\Moabom\Credit\Services\CreditSettingsService;

class CreditServiceProvider extends BaseModuleServiceProvider
{
    protected string $moduleIdentifier = 'moabom-credit';

    /**
     * Repository 인터페이스와 구현체 매핑
     *
     * @var array<class-string, class-string>
     */
    protected array $repositories = [
        CreditRepositoryInterface::class => CreditRepository::class,
    ];

    /**
     * 서비스 바인딩을 등록합니다.
     */
    public function register(): void
    {
        parent::register();

        $this->app->bind(CreditSettingsServiceInterface::class, CreditSettingsService::class);
        $this->app->singleton(CreditLevelService::class);
    }

    public function boot(): void
    {
        parent::boot();

        $this->registerSmartChatDataResources();
    }

    /**
     * 스마트챗 범용 데이터 카탈로그(`moabom.smart_chat.data_resources`)에
     * 크레딧 도메인 리소스를 등록한다 — 모두 본인(user_id) 스코프 강제.
     */
    private function registerSmartChatDataResources(): void
    {
        HookManager::addFilter(
            'moabom.smart_chat.data_resources',
            static function ($resources): array {
                $resources = is_array($resources) ? $resources : [];

                $resources[] = [
                    'name' => 'my_credit_transactions',
                    'description' => "The current user's own credit ledger (type: earn|spend|adjust|expire; spend amounts are negative).",
                    'columns' => ['id', 'type', 'amount', 'balance_after', 'description', 'created_at'],
                    'query' => static fn ($user) => \Modules\Moabom\Credit\Models\CreditTransaction::query()
                        ->where('user_id', (int) $user->id)
                        ->getQuery(),
                ];

                $resources[] = [
                    'name' => 'my_credit_attendances',
                    'description' => "The current user's own daily attendance check-ins with credit rewards.",
                    'columns' => ['id', 'attendance_date', 'reward_amount', 'ad_watched', 'created_at'],
                    'query' => static fn ($user) => \Modules\Moabom\Credit\Models\CreditAttendance::query()
                        ->where('user_id', (int) $user->id)
                        ->getQuery(),
                ];

                return $resources;
            },
        );
    }
}
