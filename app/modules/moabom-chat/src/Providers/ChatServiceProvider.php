<?php

namespace Modules\Moabom\Chat\Providers;

use App\Extension\BaseModuleServiceProvider;
use App\Extension\HookManager;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Route;
use Modules\Moabom\Chat\Contracts\ChatRepositoryInterface;
use Modules\Moabom\Chat\Http\Controllers\User\BlockController;
use Modules\Moabom\Chat\Http\Controllers\User\ConversationController;
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
        $this->registerRealtimeStateHook();
        $this->app->booted(fn (): mixed => $this->registerMissingUserRoutes());
    }

    /**
     * api.php 가 부분 배포·캐시로 누락될 때 user 라우트 404 방지.
     * 라우트별 Route::has 검사 — 한 경로만 있어도 나머지 early-return 하지 않음.
     */
    private function registerMissingUserRoutes(): void
    {
        Route::prefix('api/modules/moabom-chat')
            ->middleware('api')
            ->name('api.modules.moabom-chat.')
            ->group(function (): void {
                Route::prefix('user')->middleware(['auth:sanctum'])->group(function (): void {
                    if (! Route::has('api.modules.moabom-chat.user.blocks.destroy')) {
                        Route::delete('blocks/{userUuid}', [BlockController::class, 'destroy'])
                            ->where('userUuid', self::USER_UUID_PATTERN)
                            ->name('user.blocks.destroy');
                    }
                    if (! Route::has('api.modules.moabom-chat.user.users.eligibility')) {
                        Route::get('users/{userUuid}/eligibility', [EligibilityController::class, 'show'])
                            ->where('userUuid', self::USER_UUID_PATTERN)
                            ->name('user.users.eligibility');
                    }
                    if (! Route::has('api.modules.moabom-chat.user.conversations.destroy')) {
                        Route::delete('conversations/{conversationUuid}', [ConversationController::class, 'destroy'])
                            ->where('conversationUuid', self::USER_UUID_PATTERN)
                            ->name('user.conversations.destroy');
                    }
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

    private function registerRealtimeStateHook(): void
    {
        HookManager::addFilter('moabom.user_realtime_state', function (
            array $state,
            User $user,
            array $domains = ['notifications', 'chat', 'presence'],
        ): array {
            if (! in_array('chat', $domains, true)) {
                return $state;
            }
            $state['chat'] = app(ChatService::class)->listConversations($user);

            return $state;
        }, 20, 3);
    }
}
