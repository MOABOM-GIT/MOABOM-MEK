<?php

namespace Modules\Moabom\Smart\Chat\Providers;

use App\Extension\BaseModuleServiceProvider;
use Modules\Moabom\Smart\Chat\Services\SmartChatAttachmentService;
use Modules\Moabom\Smart\Chat\Services\SmartChatCreditGate;
use Modules\Moabom\Smart\Chat\Services\SmartChatFolderService;
use Modules\Moabom\Smart\Chat\Services\SmartChatGeneratedAppContextService;
use Modules\Moabom\Smart\Chat\Services\SmartChatLlmService;
use Modules\Moabom\Smart\Chat\Services\SmartChatMemoryService;
use Modules\Moabom\Smart\Chat\Services\SmartChatPreferenceService;
use Modules\Moabom\Smart\Chat\Services\SmartChatService;
use Modules\Moabom\Smart\Chat\Services\SmartChatShareService;
use Modules\Moabom\Smart\Chat\Services\SmartChatSiteToolService;
use Modules\Moabom\Smart\Chat\Services\SmartChatStreamConcurrencyService;
use Modules\Moabom\Smart\Chat\Services\SmartChatToolRegistry;
use Modules\Moabom\Smart\Chat\Services\SmartChatWebSearchService;

class SmartChatServiceProvider extends BaseModuleServiceProvider
{
    protected string $moduleIdentifier = 'moabom-smart-chat';

    /**
     * @var array<int, class-string>
     */
    protected array $storageServices = [
        SmartChatAttachmentService::class,
    ];

    protected array $repositories = [];

    public function register(): void
    {
        parent::register();

        $this->mergeConfigFrom(
            dirname(__DIR__, 2).'/config/moabom-smart-chat.php',
            'moabom-smart-chat',
        );

        $this->app->singleton(SmartChatStreamConcurrencyService::class);
        $this->app->singleton(SmartChatLlmService::class);
        $this->app->singleton(SmartChatCreditGate::class);
        $this->app->singleton(SmartChatAttachmentService::class);
        $this->app->singleton(SmartChatPreferenceService::class);
        $this->app->singleton(SmartChatSiteToolService::class);
        $this->app->singleton(SmartChatWebSearchService::class);
        $this->app->singleton(SmartChatGeneratedAppContextService::class);
        $this->app->singleton(SmartChatToolRegistry::class);
        $this->app->singleton(SmartChatFolderService::class);
        $this->app->singleton(SmartChatMemoryService::class);
        $this->app->singleton(SmartChatShareService::class);
        $this->app->singleton(SmartChatService::class);
    }
}
