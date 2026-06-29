<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Listeners;

use App\Seo\Contracts\SeoCacheManagerInterface;
use Illuminate\Support\Facades\Log;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;
use Modules\Moabom\Apps\Models\GeneratedApp;

/**
 * 전역 공개 마이앱 변경 시 /app/generated-app-{id} SEO 캐시를 무효화한다.
 *
 * 코어에 별도 publish/update 훅이 없으므로 GeneratedApp 모델 이벤트(saved/deleted)에
 * 직접 연결한다(우리 모듈 소유 모델). 무거운 동기 재렌더 대신 캐시 무효화만 수행하여
 * 다음 크롤러 요청 시 코어 SEO 파이프라인이 최신 HTML 을 lazy 재생성하도록 한다.
 */
final class AppSeoCacheListener
{
    public function register(): void
    {
        if (! (bool) config('moabom-apps.seo.enabled', true)) {
            return;
        }

        GeneratedApp::saved(function (GeneratedApp $app): void {
            $this->invalidateIfRelevant($app);
        });

        GeneratedApp::deleted(function (GeneratedApp $app): void {
            $this->invalidate($app->id);
        });
    }

    private function invalidateIfRelevant(GeneratedApp $app): void
    {
        $global = GeneratedAppVisibility::Global->value;

        $isGlobal = (string) ($app->visibility ?? '') === $global;
        $wasGlobal = (string) ($app->getOriginal('visibility') ?? '') === $global;

        if ($isGlobal || $wasGlobal) {
            $this->invalidate($app->id);
        }
    }

    private function invalidate(int|string|null $appId): void
    {
        $appId = (int) $appId;
        if ($appId <= 0) {
            return;
        }

        if (! app()->bound(SeoCacheManagerInterface::class)) {
            return;
        }

        $prefix = rtrim((string) config('moabom-apps.seo.detail_path_prefix', '/app'), '/');
        $url = $prefix.'/generated-app-'.$appId;

        try {
            /** @var SeoCacheManagerInterface $cache */
            $cache = app(SeoCacheManagerInterface::class);
            $cache->invalidateByUrl($url);
            // 디렉터리 인덱스도 목록 변동 반영을 위해 무효화.
            $cache->invalidateByUrl('/'.ltrim((string) config('moabom-apps.seo.index_path', '/apps'), '/'));
        } catch (\Throwable $e) {
            Log::warning('[moabom-apps][seo] cache invalidation failed', [
                'app_id' => $appId,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
