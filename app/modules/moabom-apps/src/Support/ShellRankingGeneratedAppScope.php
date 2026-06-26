<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Support;

use Modules\Moabom\Apps\Contracts\GeneratedAppRepositoryInterface;

/**
 * 셸 앱순위·사용량 ingest — 현재 Host/테넌트에서 카탈로그에 보이는 생성앱만 허용.
 * (좌측 패널 유저앱 = getPublished + GeneratedAppPublishPolicy 와 동일 SSOT)
 */
final class ShellRankingGeneratedAppScope
{
    /** @var array<string, true>|null */
    private static ?array $allowedGeneratedShellIds = null;

    public function __construct(
        private readonly GeneratedAppRepositoryInterface $generatedApps,
    ) {}

    public function allowsShellAppId(string $appId): bool
    {
        $appId = trim($appId);
        if ($appId === '') {
            return false;
        }

        if (! $this->isGeneratedShellAppId($appId)) {
            return true;
        }

        return isset($this->allowedGeneratedShellIds()[$appId]);
    }

    /**
     * @param  list<array{app_id: string, open_hits?: int, active_seconds?: int, score?: int}>  $scores
     * @return list<array{app_id: string, open_hits?: int, active_seconds?: int, score?: int}>
     */
    public function filterAppScoreRows(array $scores): array
    {
        return array_values(array_filter(
            $scores,
            fn (array $row): bool => $this->allowsShellAppId((string) ($row['app_id'] ?? '')),
        ));
    }

    /**
     * @return array<string, true>
     */
    private function allowedGeneratedShellIds(): array
    {
        if (self::$allowedGeneratedShellIds !== null) {
            return self::$allowedGeneratedShellIds;
        }

        $map = [];
        foreach ($this->generatedApps->getPublished(500) as $app) {
            $map['generated-app-'.$app->id] = true;
        }

        self::$allowedGeneratedShellIds = $map;

        return $map;
    }

    private function isGeneratedShellAppId(string $appId): bool
    {
        return (bool) preg_match('/^generated-app-[0-9]+$/', $appId);
    }

    public static function resetAllowedCacheForTest(): void
    {
        self::$allowedGeneratedShellIds = null;
    }
}
