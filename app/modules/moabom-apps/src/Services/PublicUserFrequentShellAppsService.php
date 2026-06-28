<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Services;

use Illuminate\Support\Arr;
use Modules\Moabom\Apps\Apps\AppRegistryInterface;
use Modules\Moabom\Apps\Contracts\GeneratedAppRepositoryInterface;
use Modules\Moabom\Apps\Support\GeneratedAppPublishPolicy;
use Modules\Moabom\System\Models\UserSystemSetting;

/**
 * 공개 프로필 — 사용자 홈 메인 앱 순서(shell.home.mainAppOrder) 기반 자주 쓰는 앱(최대 5).
 */
final class PublicUserFrequentShellAppsService
{
    private const DEFAULT_LIMIT = 5;

    public function __construct(
        private readonly AppRegistryInterface $appRegistry,
        private readonly GeneratedAppRepositoryInterface $generatedApps,
        private readonly AiAppService $aiAppService,
    ) {}

    /**
     * @return array{data: list<array<string, mixed>>}
     */
    public function listForUser(int $userId, int $limit = self::DEFAULT_LIMIT, ?int $viewerUserId = null): array
    {
        $limit = min(5, max(1, $limit));
        $order = $this->mainAppOrderForUser($userId);
        if ($order === []) {
            return ['data' => []];
        }

        $shellCatalog = $this->shellCatalogById();
        $items = [];

        foreach (array_slice($order, 0, $limit) as $appId) {
            $resolved = $this->resolveShellAppItem($appId, $shellCatalog, $viewerUserId);
            if ($resolved !== null) {
                $items[] = $resolved;
            }
        }

        return ['data' => $items];
    }

    /**
     * @return list<string>
     */
    private function mainAppOrderForUser(int $userId): array
    {
        $settings = UserSystemSetting::query()
            ->where('user_id', $userId)
            ->value('settings');

        $order = Arr::get(is_array($settings) ? $settings : [], 'shell.home.mainAppOrder');
        if (! is_array($order)) {
            return [];
        }

        return array_values(array_filter(array_map(
            static fn ($id): string => trim((string) $id),
            $order,
        ), static fn (string $id): bool => $id !== '' && ! str_starts_with($id, 'moa-shell-')));
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function shellCatalogById(): array
    {
        $map = [];
        foreach ($this->appRegistry->forShell('moabom-basic') as $manifest) {
            $id = trim((string) ($manifest['id'] ?? ''));
            if ($id !== '') {
                $map[$id] = $manifest;
            }
        }

        return $map;
    }

    /**
     * @param  array<string, array<string, mixed>>  $shellCatalog
     * @return array<string, mixed>|null
     */
    private function resolveShellAppItem(string $appId, array $shellCatalog, ?int $viewerUserId): ?array
    {
        if (preg_match('/^generated-app-([0-9]+)$/', $appId, $matches) === 1) {
            return $this->resolveGeneratedAppItem((int) $matches[1], $appId, $viewerUserId);
        }

        if (! isset($shellCatalog[$appId])) {
            return [
                'id' => $appId,
                'title' => $this->humanizeShellAppId($appId),
                'icon' => 'cube',
                'kind' => 'shell',
            ];
        }

        $manifest = $shellCatalog[$appId];

        return [
            'id' => $appId,
            'title' => $this->resolveLocalizedLabel($manifest['name'] ?? $appId, $appId),
            'icon' => (string) ($manifest['icon'] ?? 'cube'),
            'kind' => 'shell',
        ];
    }

    private function resolveGeneratedAppItem(int $serverId, string $shellId, ?int $viewerUserId): ?array
    {
        $app = $this->generatedApps->findById($serverId);
        if ($app === null || ! GeneratedAppPublishPolicy::isPublished($app)) {
            return null;
        }

        if (! GeneratedAppPublishPolicy::viewerCanSeePublished($app)) {
            return null;
        }

        $payload = $this->aiAppService->serializeForLibraryList($app, $viewerUserId);

        return [
            'id' => $shellId,
            'generated_app_id' => (int) $app->id,
            'title' => (string) ($payload['title'] ?? $this->humanizeShellAppId($shellId)),
            'icon' => 'cube',
            'kind' => 'generated',
            'visibility' => $payload['visibility'] ?? null,
        ];
    }

    /**
     * @param  array<string, string>|string  $label
     */
    private function resolveLocalizedLabel(array|string $label, string $fallback): string
    {
        if (is_string($label)) {
            $trimmed = trim($label);

            return $trimmed !== '' ? $trimmed : $this->humanizeShellAppId($fallback);
        }

        $locale = app()->getLocale();
        $short = str_starts_with($locale, 'ko') ? 'ko' : (str_starts_with($locale, 'en') ? 'en' : $locale);
        foreach ([$short, 'ko', 'en'] as $candidate) {
            $value = trim((string) ($label[$candidate] ?? ''));
            if ($value !== '') {
                return $value;
            }
        }

        return $this->humanizeShellAppId($fallback);
    }

    private function humanizeShellAppId(string $appId): string
    {
        return ucwords(str_replace('-', ' ', $appId));
    }
}
