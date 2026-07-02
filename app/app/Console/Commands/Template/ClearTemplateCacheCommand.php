<?php

namespace App\Console\Commands\Template;

use App\Contracts\Extension\CacheInterface;
use App\Extension\TemplateManager;
use App\Extension\Traits\ClearsTemplateCaches;
use App\Models\Template;
use App\Models\TemplateLayout;
use App\Services\LayoutService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ClearTemplateCacheCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'template:cache-clear
        {identifier? : 특정 템플릿의 캐시만 삭제 (생략 시 모든 템플릿)}';

    /**
     * The console command description.
     */
    protected $description = '템플릿 관련 캐시를 삭제합니다';

    /**
     * 템플릿 관리자
     */
    public function __construct(
        private TemplateManager $templateManager,
        private CacheInterface $cache,
        private LayoutService $layoutService,
    ) {
        parent::__construct();
    }

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $identifier = $this->argument('identifier');

        try {
            // 템플릿 디렉토리 스캔 및 로드
            $this->templateManager->loadTemplates();

            if ($identifier) {
                // 특정 템플릿 캐시만 삭제
                $this->clearSingleTemplateCache($identifier);
            } else {
                // 모든 템플릿 캐시 삭제
                $this->clearAllTemplateCache();
            }

            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error('❌ '.$e->getMessage());
            Log::error('템플릿 캐시 삭제 실패', [
                'identifier' => $identifier,
                'error' => $e->getMessage(),
            ]);

            return Command::FAILURE;
        }
    }

    /**
     * 특정 템플릿의 캐시 삭제
     */
    private function clearSingleTemplateCache(string $identifier): void
    {
        // 템플릿 존재 확인
        $template = $this->templateManager->getTemplate($identifier);
        if (! $template) {
            throw new \Exception(__('templates.errors.not_found', ['template' => $identifier]));
        }

        $this->info(__('templates.commands.cache_clear.clearing_single', ['template' => $identifier]));

        $clearedCount = 0;

        $templateRecord = Template::where('identifier', $identifier)->first();
        $clearedCount += $this->forgetVersionedTemplateCaches($identifier, $templateRecord);

        // 활성 템플릿 타입 캐시 삭제
        if ($templateRecord) {
            $this->cache->forget("templates.active.{$templateRecord->type}");
            $clearedCount++;
        }

        $this->bumpExtensionCacheVersion();
        $clearedCount++;

        $this->info('✅ '.__('templates.commands.cache_clear.success_single', [
            'template' => $identifier,
            'count' => $clearedCount,
        ]));

        Log::info(__('templates.commands.cache_clear.success_single', [
            'template' => $identifier,
            'count' => $clearedCount,
        ]));
    }

    /**
     * 모든 템플릿 캐시 삭제
     */
    private function clearAllTemplateCache(): void
    {
        $this->info(__('templates.commands.cache_clear.clearing_all'));

        $clearedCount = 0;

        // 모든 설치된 템플릿의 캐시 삭제
        $templates = Template::all();

        foreach ($templates as $templateRecord) {
            $clearedCount += $this->forgetVersionedTemplateCaches(
                $templateRecord->identifier,
                $templateRecord,
            );
        }

        // 활성 템플릿 타입 캐시 삭제
        $this->cache->forget('templates.active.admin');
        $this->cache->forget('templates.active.user');
        $clearedCount += 2;

        $this->bumpExtensionCacheVersion();
        $clearedCount++;

        $this->info('✅ '.__('templates.commands.cache_clear.success_all', [
            'count' => $clearedCount,
        ]));

        Log::info(__('templates.commands.cache_clear.success_all', [
            'count' => $clearedCount,
        ]));
    }

    /**
     * 버전 포함·레거시 키를 함께 삭제합니다.
     */
    private function forgetVersionedTemplateCaches(string $identifier, ?Template $templateRecord): int
    {
        $clearedCount = 0;
        $cacheVersion = ClearsTemplateCaches::getExtensionCacheVersion();
        $versionSuffix = ".v{$cacheVersion}";

        if ($templateRecord) {
            $layouts = TemplateLayout::where('template_id', $templateRecord->id)->get();
            foreach ($layouts as $layout) {
                $this->cache->forget("layout.{$identifier}.{$layout->name}{$versionSuffix}");
                $this->cache->forget("layout.{$identifier}.{$layout->name}");
                $this->layoutService->clearDependentLayoutsCache($templateRecord->id, (string) $layout->name);
                $clearedCount += 2;
            }
        }

        $this->cache->forget("template.routes.{$identifier}{$versionSuffix}");
        $this->cache->forget("template.routes.{$identifier}");
        $clearedCount += 2;

        $supportedLocales = config('app.supported_locales', ['ko', 'en']);
        foreach ($supportedLocales as $locale) {
            $this->cache->forget("template.language.{$identifier}.{$locale}{$versionSuffix}");
            $this->cache->forget("template.language.{$identifier}.{$locale}");
            $clearedCount += 2;
        }

        return $clearedCount;
    }

    /**
     * 프론트엔드가 새 캐시 키로 lang/routes를 요청하도록 버전을 올립니다.
     */
    private function bumpExtensionCacheVersion(): void
    {
        $this->cache->put('ext.cache_version', time());
    }
}
