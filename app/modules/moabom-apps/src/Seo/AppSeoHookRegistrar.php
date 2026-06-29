<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Seo;

use App\Extension\HookManager;

/**
 * 앱 SEO 코어 훅 등록기.
 *
 * 코어를 수정하지 않고 `core.seo.*` 확장 슬롯만 사용해:
 *  - /app/{id} (seo/app_detail), /apps (seo/apps_index) 봇 전용 메타·구조화데이터·
 *    읽을 수 있는 본문을 주입한다.
 *  - AI 크롤러 User-Agent 를 봇으로 판정한다.
 *
 * 모든 콜백은 우리 레이아웃(seo/app_detail · seo/apps_index)에서만 동작하도록
 * layoutName 으로 즉시 가드한다.
 */
final class AppSeoHookRegistrar
{
    private const LAYOUT_DETAIL = 'seo/app_detail';

    private const LAYOUT_INDEX = 'seo/apps_index';

    public function __construct(
        private readonly AppSeoDataService $seoData,
    ) {}

    public function register(): void
    {
        if (! $this->seoData->enabled()) {
            return;
        }

        HookManager::addFilter('core.seo.resolve_is_bot', function ($result, $ctx = []) {
            return $this->resolveIsBot($result, is_array($ctx) ? $ctx : []);
        });

        HookManager::addFilter('core.seo.filter_view_data', function ($viewData, $ctx = []) {
            if (! is_array($viewData)) {
                return $viewData;
            }

            return $this->filterViewData($viewData, is_array($ctx) ? $ctx : []);
        });
    }

    /**
     * AI 크롤러 UA 를 봇으로 판정(코어 defaults 미수정). 이미 판정된 값은 존중.
     */
    private function resolveIsBot(mixed $result, array $ctx): mixed
    {
        if ($result !== null) {
            return $result;
        }

        $userAgent = (string) ($ctx['userAgent'] ?? '');
        if ($userAgent === '') {
            return $result;
        }

        foreach ((array) config('moabom-apps.seo.ai_crawler_user_agents', []) as $token) {
            $token = trim((string) $token);
            if ($token !== '' && stripos($userAgent, $token) !== false) {
                return true;
            }
        }

        return $result;
    }

    /**
     * @param  array<string, mixed>  $viewData
     * @param  array<string, mixed>  $ctx
     * @return array<string, mixed>
     */
    private function filterViewData(array $viewData, array $ctx): array
    {
        $layoutName = (string) ($ctx['layoutName'] ?? '');
        if ($layoutName !== self::LAYOUT_DETAIL && $layoutName !== self::LAYOUT_INDEX) {
            return $viewData;
        }

        $locale = app()->getLocale();

        if ($layoutName === self::LAYOUT_INDEX) {
            return $this->applyIndex($viewData, $locale);
        }

        $id = $this->appIdFromUrl((string) ($viewData['canonicalUrl'] ?? ''));
        if ($id === null) {
            return $this->markNoindex($viewData);
        }

        $descriptor = $this->seoData->findPublicApp($id, $locale);
        if ($descriptor === null) {
            // 미공개·미존재 앱: 빈약·중복 콘텐츠 색인 방지.
            return $this->markNoindex($viewData);
        }

        return $this->applyDetail($viewData, $descriptor);
    }

    /**
     * @param  array<string, mixed>  $viewData
     * @param  array<string, mixed>  $app
     * @return array<string, mixed>
     */
    private function applyDetail(array $viewData, array $app): array
    {
        $title = (string) ($app['title'] ?? '');
        $description = (string) ($app['description'] ?? '');
        $url = (string) ($app['url'] ?? ($viewData['canonicalUrl'] ?? ''));
        $keywords = implode(', ', (array) ($app['keywords'] ?? []));

        if ($title !== '') {
            $viewData['title'] = $title;
        }
        if ($description !== '') {
            $viewData['description'] = $description;
        }
        if ($keywords !== '') {
            $viewData['keywords'] = $keywords;
        }
        if ($url !== '') {
            $viewData['canonicalUrl'] = $url;
        }

        $viewData['ogTags'] = $this->buildOgTags($title, $description, $url, $app['og_image'] ?? null);
        $viewData['twitterTags'] = $this->buildTwitterTags($title, $description, $app['og_image'] ?? null);
        $viewData['jsonLd'] = $this->buildAppJsonLd($app);
        $viewData['extraBodyEnd'] = $this->buildDetailBody($app).($viewData['extraBodyEnd'] ?? '');

        return $viewData;
    }

    /**
     * @param  array<string, mixed>  $viewData
     * @return array<string, mixed>
     */
    private function applyIndex(array $viewData, string $locale): array
    {
        $apps = $this->seoData->publicApps($locale);
        $title = (string) __('moabom-apps::messages.apps.seo.index_title');
        $description = (string) __('moabom-apps::messages.apps.seo.index_description');
        $url = (string) ($this->seoData->indexDescriptor($locale)['url'] ?? ($viewData['canonicalUrl'] ?? ''));

        if ($title !== '') {
            $viewData['title'] = $title;
        }
        if ($description !== '') {
            $viewData['description'] = $description;
        }
        if ($url !== '') {
            $viewData['canonicalUrl'] = $url;
        }

        $viewData['ogTags'] = $this->buildOgTags($title, $description, $url, null);
        $viewData['twitterTags'] = $this->buildTwitterTags($title, $description, null);
        $viewData['jsonLd'] = $this->buildIndexJsonLd($title, $description, $url, $apps);
        $viewData['extraBodyEnd'] = $this->buildIndexBody($title, $description, $apps).($viewData['extraBodyEnd'] ?? '');

        return $viewData;
    }

    /**
     * @param  array<string, mixed>  $viewData
     * @return array<string, mixed>
     */
    private function markNoindex(array $viewData): array
    {
        $tag = '    <meta name="robots" content="noindex, follow">'."\n";
        $existing = (string) ($viewData['extraHeadTags'] ?? '');
        if (! str_contains($existing, 'name="robots"')) {
            $viewData['extraHeadTags'] = $tag.$existing;
        }

        return $viewData;
    }

    private function appIdFromUrl(string $url): ?string
    {
        if ($url === '') {
            return null;
        }

        $path = parse_url($url, PHP_URL_PATH);
        if (! is_string($path) || $path === '') {
            return null;
        }

        $prefix = rtrim((string) config('moabom-apps.seo.detail_path_prefix', '/app'), '/').'/';
        if (! str_starts_with($path, $prefix)) {
            return null;
        }

        $id = trim(substr($path, strlen($prefix)), '/');
        if ($id === '' || str_contains($id, '/')) {
            return null;
        }

        return rawurldecode($id);
    }

    private function buildOgTags(string $title, string $description, string $url, ?string $image): string
    {
        $tags = '    <meta property="og:type" content="website">'."\n";
        $tags .= '    <meta property="og:title" content="'.e($title).'">'."\n";
        $tags .= '    <meta property="og:description" content="'.e($description).'">'."\n";
        if ($url !== '') {
            $tags .= '    <meta property="og:url" content="'.e($url).'">'."\n";
        }
        if (is_string($image) && $image !== '') {
            $tags .= '    <meta property="og:image" content="'.e($image).'">'."\n";
        }

        return $tags;
    }

    private function buildTwitterTags(string $title, string $description, ?string $image): string
    {
        $card = is_string($image) && $image !== '' ? 'summary_large_image' : 'summary';
        $tags = '    <meta name="twitter:card" content="'.$card.'">'."\n";
        $tags .= '    <meta name="twitter:title" content="'.e($title).'">'."\n";
        $tags .= '    <meta name="twitter:description" content="'.e($description).'">'."\n";
        if (is_string($image) && $image !== '') {
            $tags .= '    <meta name="twitter:image" content="'.e($image).'">'."\n";
        }

        return $tags;
    }

    /**
     * @param  array<string, mixed>  $app
     */
    private function buildAppJsonLd(array $app): string
    {
        $data = [
            '@context' => 'https://schema.org',
            '@type' => ($app['type'] ?? null) === 'generated' ? 'WebApplication' : 'SoftwareApplication',
            'name' => (string) ($app['title'] ?? ''),
            'description' => (string) ($app['description'] ?? ''),
            'url' => (string) ($app['url'] ?? ''),
            'applicationCategory' => 'WebApplication',
            'operatingSystem' => 'Web',
            'offers' => [
                '@type' => 'Offer',
                'price' => '0',
                'priceCurrency' => 'USD',
            ],
        ];

        $image = $app['og_image'] ?? null;
        if (is_string($image) && $image !== '') {
            $data['image'] = $image;
        }

        $author = $app['author'] ?? null;
        if (is_string($author) && $author !== '') {
            $data['author'] = ['@type' => 'Person', 'name' => $author];
        }

        $rating = $app['rating'] ?? null;
        if (is_array($rating) && (int) ($rating['count'] ?? 0) > 0) {
            $data['aggregateRating'] = [
                '@type' => 'AggregateRating',
                'ratingValue' => (string) $rating['value'],
                'ratingCount' => (int) $rating['count'],
            ];
        }

        return $this->encodeJson($data);
    }

    /**
     * @param  list<array<string, mixed>>  $apps
     */
    private function buildIndexJsonLd(string $title, string $description, string $url, array $apps): string
    {
        $items = [];
        $position = 1;
        foreach ($apps as $app) {
            $items[] = [
                '@type' => 'ListItem',
                'position' => $position++,
                'name' => (string) ($app['title'] ?? ''),
                'url' => (string) ($app['url'] ?? ''),
            ];
        }

        $data = [
            '@context' => 'https://schema.org',
            '@type' => 'CollectionPage',
            'name' => $title,
            'description' => $description,
            'url' => $url,
            'mainEntity' => [
                '@type' => 'ItemList',
                'numberOfItems' => count($items),
                'itemListElement' => $items,
            ],
        ];

        return $this->encodeJson($data);
    }

    /**
     * @param  array<string, mixed>  $app
     */
    private function buildDetailBody(array $app): string
    {
        $title = e((string) ($app['title'] ?? ''));
        $description = e((string) ($app['description'] ?? ''));
        $path = e((string) ($app['path'] ?? ''));
        $openLabel = e((string) __('moabom-apps::messages.apps.seo.open_app'));
        $directoryLabel = e((string) __('moabom-apps::messages.apps.seo.directory_link'));
        $indexPath = e('/'.ltrim((string) config('moabom-apps.seo.index_path', '/apps'), '/'));

        $categoryKey = ($app['category'] ?? null) === 'user' ? 'category_user' : 'category_basic';
        $categoryLabel = e((string) __('moabom-apps::messages.apps.seo.'.$categoryKey));

        $html = '<main class="moa-seo-app" aria-hidden="true">'."\n";
        $html .= '  <article>'."\n";
        $html .= '    <h1>'.$title.'</h1>'."\n";
        $html .= '    <p class="moa-seo-app__category">'.$categoryLabel.'</p>'."\n";
        $html .= '    <p class="moa-seo-app__description">'.$description.'</p>'."\n";
        $html .= '    <p><a href="'.$path.'">'.$openLabel.'</a></p>'."\n";

        $preview = $app['preview_url'] ?? null;
        if (is_string($preview) && $preview !== '') {
            $liveLabel = e((string) __('moabom-apps::messages.apps.seo.open_live'));
            $html .= '    <p><a href="'.e($preview).'" rel="nofollow">'.$liveLabel.'</a></p>'."\n";
        }

        $html .= '    <p><a href="'.$indexPath.'">'.$directoryLabel.'</a></p>'."\n";
        $html .= '  </article>'."\n";
        $html .= '</main>'."\n";

        return $html;
    }

    /**
     * @param  list<array<string, mixed>>  $apps
     */
    private function buildIndexBody(string $title, string $description, array $apps): string
    {
        $builtin = array_values(array_filter($apps, static fn ($a): bool => ($a['category'] ?? null) !== 'user'));
        $generated = array_values(array_filter($apps, static fn ($a): bool => ($a['category'] ?? null) === 'user'));

        $html = '<main class="moa-seo-apps" aria-hidden="true">'."\n";
        $html .= '  <h1>'.e($title).'</h1>'."\n";
        $html .= '  <p>'.e($description).'</p>'."\n";
        $html .= $this->buildIndexSection((string) __('moabom-apps::messages.apps.seo.category_basic'), $builtin);
        $html .= $this->buildIndexSection((string) __('moabom-apps::messages.apps.seo.category_user'), $generated);
        $html .= '</main>'."\n";

        return $html;
    }

    /**
     * @param  list<array<string, mixed>>  $apps
     */
    private function buildIndexSection(string $heading, array $apps): string
    {
        if ($apps === []) {
            return '';
        }

        $html = '  <section>'."\n";
        $html .= '    <h2>'.e($heading).'</h2>'."\n";
        $html .= '    <ul>'."\n";
        foreach ($apps as $app) {
            $path = e((string) ($app['path'] ?? ''));
            $name = e((string) ($app['title'] ?? ''));
            $desc = e((string) ($app['description'] ?? ''));
            $html .= '      <li><a href="'.$path.'">'.$name.'</a> — '.$desc.'</li>'."\n";
        }
        $html .= '    </ul>'."\n";
        $html .= '  </section>'."\n";

        return $html;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function encodeJson(array $data): string
    {
        return (string) json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}
