<?php

namespace Modules\Moabom\Presence\Providers;

use App\Extension\BaseModuleServiceProvider;
use App\Extension\HookManager;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;
use Modules\Moabom\Presence\Console\Commands\PresencePlatformMigrateCommand;
use Modules\Moabom\Presence\Contracts\FriendshipRepositoryInterface;
use Modules\Moabom\Presence\Contracts\PlatformPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Contracts\PresenceRevisionRepositoryInterface;
use Modules\Moabom\Presence\Contracts\PresenceUserPreferencesRepositoryInterface;
use Modules\Moabom\Presence\Contracts\TenantPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Repositories\FriendshipRepository;
use Modules\Moabom\Presence\Repositories\PlatformPresenceSessionRepository;
use Modules\Moabom\Presence\Repositories\PresenceRevisionRepository;
use Modules\Moabom\Presence\Repositories\PresenceUserPreferencesRepository;
use Modules\Moabom\Presence\Repositories\TenantPresenceSessionRepository;
use Modules\Moabom\Presence\Support\PresenceChannelNames;
use Modules\Moabom\Presence\Support\PresenceClientIpMasker;
use Modules\Moabom\Presence\Services\FriendshipService;
use Modules\Moabom\Presence\Services\PresencePresentationService;
use Modules\Moabom\Presence\Services\PresenceRevisionService;
use Modules\Moabom\Presence\Services\PresenceSummaryService;
use Modules\Moabom\Presence\Services\PresenceUserPreferencesService;
use Modules\Moabom\Presence\Services\TenantOnlineUsersService;

class PresenceServiceProvider extends BaseModuleServiceProvider
{
    protected string $moduleIdentifier = 'moabom-presence';

    /**
     * @var array<class-string, class-string>
     */
    protected array $repositories = [
        FriendshipRepositoryInterface::class => FriendshipRepository::class,
        TenantPresenceSessionRepositoryInterface::class => TenantPresenceSessionRepository::class,
        PlatformPresenceSessionRepositoryInterface::class => PlatformPresenceSessionRepository::class,
        PresenceRevisionRepositoryInterface::class => PresenceRevisionRepository::class,
        PresenceUserPreferencesRepositoryInterface::class => PresenceUserPreferencesRepository::class,
    ];

    public function boot(): void
    {
        parent::boot();

        $this->registerPresenceChannels();
        $this->registerShellStateHook();
        $this->registerRealtimeStateHook();

        if ($this->app->runningInConsole()) {
            $this->commands([
                PresencePlatformMigrateCommand::class,
            ]);
        }
    }

    private function registerPresenceChannels(): void
    {
        Broadcast::channel('module.moabom-presence.tenant.{tenantSlug}.online', function ($user, string $tenantSlug) {
            if (app(PresenceChannelNames::class)->tenantSlug() !== $tenantSlug) {
                return false;
            }

            return [
                'uuid' => $user->uuid,
                'name' => (string) ($user->nickname ?: $user->name),
                'avatar' => $user->getAvatarUrl(),
            ];
        });
    }

    private function registerShellStateHook(): void
    {
        HookManager::addFilter('moabom.user_shell_state', function (array $state, User $user): array {
            $preferences = app(PresenceUserPreferencesService::class)->getForUser((int) $user->id);
            $state['presence'] = [
                'summary' => app(PresenceSummaryService::class)->getSummary(),
                'settings' => app(PresencePresentationService::class)->serializeSettings($preferences),
            ];

            return $state;
        }, priority: 20);
    }

    private function registerRealtimeStateHook(): void
    {
        HookManager::addFilter('moabom.user_realtime_state', function (
            array $state,
            User $user,
            array $domains = ['notifications', 'chat', 'presence'],
        ): array {
            if (! in_array('presence', $domains, true)) {
                return $state;
            }
            $viewerMaskedIp = app(PresenceClientIpMasker::class)->maskFromRequest(request());
            $state['presence'] = [
                'summary' => app(PresenceSummaryService::class)->getSummary(),
                'friends' => app(FriendshipService::class)->listFriends($user),
                'online' => [
                    'revision' => app(PresenceRevisionService::class)->current(),
                    'users' => app(TenantOnlineUsersService::class)->listOnlineUsers($user, 50, $viewerMaskedIp),
                ],
            ];

            return $state;
        }, 30, 3);
    }
}
