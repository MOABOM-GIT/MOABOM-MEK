<?php

namespace Modules\Moabom\Chat\Providers;

use App\Extension\BaseModuleServiceProvider;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Route;
use Modules\Moabom\Chat\Contracts\ChatRepositoryInterface;
use Modules\Moabom\Chat\Http\Controllers\User\BlockController;
use Modules\Moabom\Chat\Http\Controllers\User\EligibilityController;
use Modules\Moabom\Chat\Repositories\ChatRepository;
use Modules\Moabom\Chat\Services\ChatService;
use Modules\Moabom\System\Saas\TenantContext;

class ChatServiceProvider extends BaseModuleServiceProvider
{
    protected string $moduleIdentifier = 'moabom-chat';

    private const USER_UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

    /**
     * @var array<class-string, class-string>
     */
    protected array $repositories = [
        ChatRepositoryInterface::class => ChatRepository::class,
    ];

    public function boot(): void
    {
        parent::boot();

        $this->registerChatChannels();
        $this->app->booted(fn (): mixed => $this->registerMissingUserRoutes());
    }

    /**
     * api.php 가 부분 배포·캐시로 누락될 때 프로필 차단 해제·eligibility 404 방지.
     * 정상 경로에서는 api.php 가 먼저 등록하므로 no-op.
     */
    private function registerMissingUserRoutes(): void
    {
        if (Route::has('api.modules.moabom-chat.user.blocks.destroy')) {
            return;
        }

        Route::prefix('api/modules/moabom-chat')
            ->middleware('api')
            ->name('api.modules.moabom-chat.')
            ->group(function (): void {
                Route::prefix('user')->middleware(['auth:sanctum'])->group(function (): void {
                    Route::delete('blocks/{userUuid}', [BlockController::class, 'destroy'])
                        ->where('userUuid', self::USER_UUID_PATTERN)
                        ->name('user.blocks.destroy');
                    Route::get('users/{userUuid}/eligibility', [EligibilityController::class, 'show'])
                        ->where('userUuid', self::USER_UUID_PATTERN)
                        ->name('user.users.eligibility');
                });
            });
    }

    private function registerChatChannels(): void
    {
        Broadcast::channel('module.moabom-chat.tenant.{tenantSlug}.conversation.{conversationUuid}', function ($user, string $tenantSlug, string $conversationUuid) {
            $context = app(TenantContext::class);
            if ((string) ($context->tenantId() ?: 'default') !== $tenantSlug) {
                return false;
            }

            return app(ChatService::class)->canAccessConversation($user, $conversationUuid);
        });
    }
}
