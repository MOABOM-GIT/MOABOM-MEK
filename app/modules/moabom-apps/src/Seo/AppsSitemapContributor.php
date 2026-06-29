<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Seo;

use App\Seo\Contracts\SitemapContributorInterface;

/**
 * 앱 디렉터리(/apps) + 기본 제공 앱 + 전역 공개 마이앱 sitemap 기여자.
 *
 * private/tenant 마이앱은 AppSeoDataService 가드로 자동 제외된다.
 */
final class AppsSitemapContributor implements SitemapContributorInterface
{
    public function __construct(
        private readonly AppSeoDataService $seoData,
    ) {}

    public function getIdentifier(): string
    {
        return 'moabom-apps';
    }

    /**
     * @return array<int, array{loc: string, lastmod?: string, changefreq?: string, priority?: float}>
     */
    public function getUrls(): array
    {
        if (! $this->seoData->enabled()) {
            return [];
        }

        $locale = (string) config('app.locale', 'ko');

        $urls = [];

        $index = $this->seoData->indexDescriptor($locale);
        $urls[] = [
            'loc' => (string) ($index['url'] ?? ''),
            'changefreq' => 'daily',
            'priority' => 0.7,
        ];

        foreach ($this->seoData->publicApps($locale) as $app) {
            $loc = (string) ($app['url'] ?? '');
            if ($loc === '') {
                continue;
            }

            $entry = [
                'loc' => $loc,
                'changefreq' => ($app['type'] ?? null) === 'generated' ? 'weekly' : 'monthly',
                'priority' => ($app['type'] ?? null) === 'generated' ? 0.5 : 0.6,
            ];

            $lastmod = $app['lastmod'] ?? null;
            if (is_string($lastmod) && $lastmod !== '') {
                $entry['lastmod'] = $lastmod;
            }

            $urls[] = $entry;
        }

        return array_values(array_filter($urls, static fn (array $e): bool => $e['loc'] !== ''));
    }
}
