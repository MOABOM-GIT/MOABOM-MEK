<?php

namespace Modules\Moabom\Presence\Providers;

use App\Extension\BaseModuleServiceProvider;
use Illuminate\Support\Facades\Broadcast;
use Modules\Moabom\Presence\Console\Commands\PresencePlatformMigrateCommand;
use Modules\Moabom\Presence\Contracts\FriendshipRepositoryInterface;
use Modules\Moabom\Presence\Contracts\PlatformPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Contracts\PresenceUserPreferencesRepositoryInterface;
use Modules\Moabom\Presence\Contracts\TenantPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Repositories\FriendshipRepository;
use Modules\Moabom\Presence\Repositories\PlatformPresenceSessionRepository;
use Modules\Moabom\Presence\Repositories\PresenceUserPreferencesRepository;
use Modules\Moabom\Presence\Repositories\TenantPresenceSessionRepository;
use Modules\Moabom\Presence\Support\PresenceChannelNames;

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
        PresenceUserPreferencesRepositoryInterface::class => PresenceUserPreferencesRepository::class,
    ];

    public function boot(): void
    {
        parent::boot();

        $this->registerPresenceChannels();

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
}
