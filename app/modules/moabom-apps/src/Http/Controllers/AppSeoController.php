<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\PublicBaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Modules\Moabom\Apps\Seo\AppSeoDataService;

/**
 * 공개 앱 SEO 데이터 API (인증 불필요).
 *
 * 기본 제공 앱 + 전역 공개 마이앱만 노출한다. 외부 검색·AI 소비자 및
 * (선택적) 레이아웃 meta.seo.data_sources 가 사용한다.
 */
class AppSeoController extends PublicBaseController
{
    public function __construct(
        private readonly AppSeoDataService $seoData,
    ) {
        parent::__construct();
    }

    /**
     * 공개 앱 디스크립터 목록.
     */
    public function index(): JsonResponse
    {
        $locale = app()->getLocale();

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.seo.list_success',
            [
                'items' => $this->seoData->publicApps($locale),
            ],
        );
    }

    /**
     * 공개 앱 디스크립터 단건. 미공개·미존재 시 404.
     */
    public function show(string $id): JsonResponse
    {
        $locale = app()->getLocale();
        $descriptor = $this->seoData->findPublicApp($id, $locale);

        if ($descriptor === null) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.seo.not_found',
                404,
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.seo.show_success',
            $descriptor,
        );
    }

    /**
     * robots.txt 동적 폴백(정적 public/robots.txt 가 우선 서빙되는 환경에서는 사용되지 않음).
     */
    public function robots(): Response
    {
        $sitemap = rtrim((string) url('/'), '/').'/sitemap.xml';

        $lines = ['User-agent: *', 'Allow: /', '', 'Sitemap: '.$sitemap, ''];

        return response(implode("\n", $lines), 200, ['Content-Type' => 'text/plain; charset=UTF-8']);
    }

    /**
     * llms.txt — AI 어시스턴트용 공개 앱 인덱스(https://llmstxt.org 규약).
     */
    public function llms(): Response
    {
        $locale = app()->getLocale();
        $siteName = (string) (g7_core_settings('general.site_name', '') ?: config('app.name', 'MOABOM'));

        $lines = [];
        $lines[] = '# '.$siteName;
        $lines[] = '';
        $lines[] = '> '.(string) __('moabom-apps::messages.apps.seo.index_description');
        $lines[] = '';
        $lines[] = '## '.(string) __('moabom-apps::messages.apps.seo.category_basic');

        $generatedHeaderAdded = false;
        foreach ($this->seoData->publicApps($locale) as $app) {
            if (($app['category'] ?? null) === 'user' && ! $generatedHeaderAdded) {
                $lines[] = '';
                $lines[] = '## '.(string) __('moabom-apps::messages.apps.seo.category_user');
                $generatedHeaderAdded = true;
            }

            $title = trim((string) ($app['title'] ?? ''));
            $url = trim((string) ($app['url'] ?? ''));
            $desc = trim((string) ($app['description'] ?? ''));
            if ($title === '' || $url === '') {
                continue;
            }

            $lines[] = $desc !== ''
                ? sprintf('- [%s](%s): %s', $title, $url, $desc)
                : sprintf('- [%s](%s)', $title, $url);
        }

        $lines[] = '';

        return response(implode("\n", $lines), 200, ['Content-Type' => 'text/plain; charset=UTF-8']);
    }
}
