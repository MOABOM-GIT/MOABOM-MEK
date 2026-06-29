<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Seo;

use Illuminate\Support\Str;
use Modules\Moabom\Apps\Apps\AppManifest;
use Modules\Moabom\Apps\Apps\AppRegistryInterface;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;

/**
 * 앱 SEO 데이터 SSOT.
 *
 * 기본 제공 앱(AppRegistry app.json + config 보강) + 전역 공개(visibility=global)
 * 공개 마이앱만 SEO 디스크립터로 정규화한다. private/tenant 마이앱은 이 서비스에서
 * 절대 노출되지 않는다(단일 가드 지점).
 *
 * @phpstan-type AppSeoDescriptor array{
 *     id: string,
 *     type: string,
 *     title: string,
 *     description: string,
 *     category: string,
 *     keywords: list<string>,
 *     path: string,
 *     url: string,
 *     preview_url: ?string,
 *     og_image: ?string,
 *     lastmod: ?string,
 *     app_type: ?string,
 *     author: ?string,
 *     rating: ?array{value: float, count: int}
 * }
 */
final class AppSeoDataService
{
    public function __construct(
        private readonly AppRegistryInterface $registry,
    ) {}

    /**
     * SEO 노출이 전역적으로 활성인지.
     */
    public function enabled(): bool
    {
        return (bool) config('moabom-apps.seo.enabled', true);
    }

    /**
     * 공개 앱 디스크립터 전체(기본앱 + 전역 공개 마이앱).
     *
     * @return list<array<string, mixed>>
     */
    public function publicApps(string $locale): array
    {
        if (! $this->enabled()) {
            return [];
        }

        return array_merge(
            $this->builtinApps($locale),
            $this->generatedApps($locale),
        );
    }

    /**
     * 단건 공개 앱 디스크립터. 미공개·미존재 시 null.
     *
     * @return array<string, mixed>|null
     */
    public function findPublicApp(string $id, string $locale): ?array
    {
        if (! $this->enabled()) {
            return null;
        }

        $id = trim($id);
        if ($id === '') {
            return null;
        }

        $generatedId = $this->parseGeneratedId($id);
        if ($generatedId !== null) {
            $app = $this->findGlobalGeneratedApp($generatedId);

            return $app !== null ? $this->describeGenerated($app, $locale) : null;
        }

        if (in_array($id, $this->excludedBuiltinIds(), true)) {
            return null;
        }

        foreach ($this->builtinApps($locale) as $descriptor) {
            if (($descriptor['id'] ?? null) === $id) {
                return $descriptor;
            }
        }

        return null;
    }

    /**
     * 디렉터리(/apps) 페이지 디스크립터.
     *
     * @return array<string, mixed>
     */
    public function indexDescriptor(string $locale): array
    {
        return [
            'path' => $this->indexPath(),
            'url' => $this->absoluteUrl($this->indexPath()),
        ];
    }

    /**
     * 기본 제공 앱 디스크립터(AppRegistry + config 보강, 제외 목록 적용).
     *
     * @return list<array<string, mixed>>
     */
    private function builtinApps(string $locale): array
    {
        $excluded = $this->excludedBuiltinIds();
        $byId = [];

        foreach ($this->registry->all() as $manifest) {
            if (in_array($manifest->id, $excluded, true)) {
                continue;
            }
            $byId[$manifest->id] = $this->describeManifest($manifest, $locale);
        }

        foreach ((array) config('moabom-apps.seo.builtin', []) as $entry) {
            if (! is_array($entry)) {
                continue;
            }
            $id = trim((string) ($entry['id'] ?? ''));
            if ($id === '' || in_array($id, $excluded, true) || isset($byId[$id])) {
                continue;
            }
            $byId[$id] = $this->describeBuiltinConfig($id, $entry, $locale);
        }

        $apps = array_values($byId);

        usort(
            $apps,
            static fn (array $a, array $b): int => [$a['order'] ?? 100, $a['id']] <=> [$b['order'] ?? 100, $b['id']],
        );

        return $apps;
    }

    /**
     * 전역 공개 마이앱 디스크립터.
     *
     * @return list<array<string, mixed>>
     */
    private function generatedApps(string $locale): array
    {
        $max = max(1, (int) config('moabom-apps.seo.max_generated', 1000));

        $apps = GeneratedAppsConnection::apps()
            ->where('visibility', GeneratedAppVisibility::Global->value)
            ->latest('updated_at')
            ->limit($max)
            ->get();

        $out = [];
        foreach ($apps as $app) {
            $out[] = $this->describeGenerated($app, $locale);
        }

        return $out;
    }

    private function findGlobalGeneratedApp(int $id): ?GeneratedApp
    {
        return GeneratedAppsConnection::apps()
            ->whereKey($id)
            ->where('visibility', GeneratedAppVisibility::Global->value)
            ->first();
    }

    /**
     * @return array<string, mixed>
     */
    private function describeManifest(AppManifest $manifest, string $locale): array
    {
        $title = $this->localize($manifest->name, $locale, $manifest->id);
        $description = $this->localize($manifest->description, $locale, '');

        return [
            'id' => $manifest->id,
            'type' => 'builtin',
            'title' => $title,
            'description' => $description !== '' ? $description : $this->genericBuiltinDescription($title, $locale),
            'category' => $manifest->category,
            'keywords' => $this->deriveKeywords($title, $description),
            'path' => $this->detailPath($manifest->id),
            'url' => $this->absoluteUrl($this->detailPath($manifest->id)),
            'preview_url' => null,
            'og_image' => null,
            'lastmod' => null,
            'app_type' => null,
            'author' => null,
            'rating' => null,
            'order' => $manifest->order,
        ];
    }

    /**
     * @param  array<string, mixed>  $entry
     * @return array<string, mixed>
     */
    private function describeBuiltinConfig(string $id, array $entry, string $locale): array
    {
        $title = $this->localize($entry['name'] ?? $id, $locale, $id);
        $description = $this->localize($entry['description'] ?? '', $locale, '');
        $keywords = array_values(array_filter(array_map(
            static fn ($k): string => trim((string) $k),
            (array) ($entry['keywords'] ?? []),
        )));

        return [
            'id' => $id,
            'type' => 'builtin',
            'title' => $title,
            'description' => $description !== '' ? $description : $this->genericBuiltinDescription($title, $locale),
            'category' => (string) ($entry['category'] ?? 'basic'),
            'keywords' => $keywords !== [] ? $keywords : $this->deriveKeywords($title, $description),
            'path' => $this->detailPath($id),
            'url' => $this->absoluteUrl($this->detailPath($id)),
            'preview_url' => null,
            'og_image' => isset($entry['og_image']) ? (string) $entry['og_image'] : null,
            'lastmod' => null,
            'app_type' => null,
            'author' => null,
            'rating' => null,
            'order' => (int) ($entry['order'] ?? 100),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function describeGenerated(GeneratedApp $app, string $locale): array
    {
        $id = 'generated-app-'.$app->id;
        $title = trim((string) ($app->title ?? ''));
        if ($title === '') {
            $title = $this->genericGeneratedTitle($locale);
        }

        $description = $this->sanitizeText((string) ($app->prompt ?? ''));
        if ($description === '') {
            $description = $this->genericGeneratedDescription($title, $locale);
        }

        $metadata = is_array($app->metadata) ? $app->metadata : [];
        $ogImage = null;
        foreach (['og_image', 'icon_image_url', 'iconImageUrl'] as $key) {
            $value = $metadata[$key] ?? null;
            if (is_string($value) && $value !== '') {
                $ogImage = $value;
                break;
            }
        }

        $ratingCount = (int) ($app->community_rating_count ?? 0);
        $rating = null;
        if ($ratingCount > 0 && $app->community_rating_avg !== null) {
            $rating = [
                'value' => round((float) $app->community_rating_avg, 2),
                'count' => $ratingCount,
            ];
        }

        return [
            'id' => $id,
            'type' => 'generated',
            'title' => $title,
            'description' => $description,
            'category' => 'user',
            'keywords' => $this->deriveKeywords($title, $description),
            'path' => $this->detailPath($id),
            'url' => $this->absoluteUrl($this->detailPath($id)),
            'preview_url' => $this->generatedPreviewUrl($app),
            'og_image' => $ogImage,
            'lastmod' => $app->updated_at?->toW3cString(),
            'app_type' => $app->app_type !== null ? (string) $app->app_type : null,
            'author' => $this->generatedAuthor($app),
            'rating' => $rating,
            'order' => 1000,
        ];
    }

    private function generatedPreviewUrl(GeneratedApp $app): ?string
    {
        if (GeneratedAppsConnection::usesPlatformStore()) {
            $scheme = trim((string) config('moabom-apps.preview.scheme', 'https'));
            $host = trim((string) config('moabom-apps.preview.standard_host', 'apps.mek360.com'));

            return $scheme.'://'.$host.'/g/'.$app->id;
        }

        return rtrim((string) config('app.url', ''), '/').'/g/'.$app->id;
    }

    private function generatedAuthor(GeneratedApp $app): ?string
    {
        $user = $app->relationLoaded('user') ? $app->getRelation('user') : null;
        $nickname = is_object($user) ? trim((string) ($user->nickname ?? $user->name ?? '')) : '';

        return $nickname !== '' ? $nickname : null;
    }

    /**
     * 다국어 값(array|string)을 로케일에 맞춰 단일 문자열로 해석한다.
     */
    private function localize(array|string $value, string $locale, string $fallback): string
    {
        if (is_string($value)) {
            $trimmed = trim($value);

            return $trimmed !== '' ? $trimmed : $fallback;
        }

        $candidates = [$locale, (string) config('app.fallback_locale', 'en'), 'ko', 'en'];
        foreach ($candidates as $candidate) {
            $candidate = (string) $candidate;
            if ($candidate !== '' && isset($value[$candidate]) && is_string($value[$candidate]) && trim($value[$candidate]) !== '') {
                return trim($value[$candidate]);
            }
        }

        foreach ($value as $entry) {
            if (is_string($entry) && trim($entry) !== '') {
                return trim($entry);
            }
        }

        return $fallback;
    }

    /**
     * HTML/제어문자 제거 후 SEO description 길이로 정규화.
     */
    private function sanitizeText(string $raw, int $limit = 155): string
    {
        $text = strip_tags($raw);
        $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
        $text = trim($text);
        if ($text === '') {
            return '';
        }

        return Str::limit($text, $limit, '…');
    }

    /**
     * @return list<string>
     */
    private function deriveKeywords(string $title, string $description): array
    {
        $base = trim($title.' '.$description);
        if ($base === '') {
            return [];
        }

        $tokens = preg_split('/[\s,·\/|]+/u', $base) ?: [];
        $keywords = [];
        foreach ($tokens as $token) {
            $token = trim((string) $token, " \t\n\r\0\x0B.,!?\"'()[]{}");
            if (mb_strlen($token) < 2) {
                continue;
            }
            $keywords[mb_strtolower($token)] = $token;
            if (count($keywords) >= 10) {
                break;
            }
        }

        return array_values($keywords);
    }

    private function genericBuiltinDescription(string $title, string $locale): string
    {
        return str_starts_with($locale, 'ko')
            ? sprintf('%s — 모아봄에서 바로 사용할 수 있는 기본 제공 웹앱입니다.', $title)
            : sprintf('%s — a built-in web app you can use right away on MOABOM.', $title);
    }

    private function genericGeneratedTitle(string $locale): string
    {
        return str_starts_with($locale, 'ko') ? 'AI로 만든 앱' : 'AI-generated app';
    }

    private function genericGeneratedDescription(string $title, string $locale): string
    {
        return str_starts_with($locale, 'ko')
            ? sprintf('%s — 모아봄 사용자가 AI로 만들어 공개한 웹앱입니다.', $title)
            : sprintf('%s — a web app created with AI and shared by a MOABOM user.', $title);
    }

    private function parseGeneratedId(string $id): ?int
    {
        if (preg_match('/^generated-app-(\d+)$/', $id, $m) === 1) {
            return (int) $m[1];
        }

        return null;
    }

    /**
     * @return list<string>
     */
    private function excludedBuiltinIds(): array
    {
        return array_values(array_filter(array_map(
            static fn ($v): string => trim((string) $v),
            (array) config('moabom-apps.seo.exclude', []),
        )));
    }

    private function detailPath(string $id): string
    {
        return rtrim((string) config('moabom-apps.seo.detail_path_prefix', '/app'), '/').'/'.$id;
    }

    private function indexPath(): string
    {
        return '/'.ltrim((string) config('moabom-apps.seo.index_path', '/apps'), '/');
    }

    private function absoluteUrl(string $path): string
    {
        $base = trim((string) config('moabom-apps.seo.canonical_base', ''));
        if ($base === '') {
            $base = (string) config('app.url', '');
        }

        return rtrim($base, '/').'/'.ltrim($path, '/');
    }
}
