<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Services;

use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Models\GeneratedAppRevision;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;

/**
 * 생성앱 HTML 리비전(타임머신) SSOT.
 *
 * - store/update 시 스냅샷
 * - list / show / restore (복원 시 현재 HTML 교체 + restore 소스 스냅샷)
 */
class GeneratedAppVersionService
{
    public const SOURCE_SAVE = 'save';

    public const SOURCE_RESTORE = 'restore';

    public const SOURCE_PATCH = 'patch';

    public const SOURCE_IMPORT = 'import';

    private const MAX_REVISIONS_PER_APP = 40;

    public function __construct(
        private readonly GeneratedAppHtmlService $htmlService,
    ) {}

    /**
     * HTML 이 비어 있지 않고, 직전 스냅샷과 해시가 다를 때만 새 리비전을 만든다.
     */
    public function snapshot(GeneratedApp $app, string $source = self::SOURCE_SAVE, ?int $createdBy = null): ?GeneratedAppRevision
    {
        $html = (string) ($app->html ?? '');
        if ($html === '') {
            return null;
        }

        $hash = hash('sha256', $html);
        $latest = $this->latestRevision((int) $app->id);
        if ($latest !== null && $latest->html_hash === $hash) {
            return null;
        }

        $nextNumber = $latest !== null ? ((int) $latest->revision_number) + 1 : 1;

        $revision = GeneratedAppsConnection::revisions()->create([
            'generated_app_id' => (int) $app->id,
            'revision_number' => $nextNumber,
            'source' => $this->normalizeSource($source),
            'html_hash' => $hash,
            'html' => $html,
            'title' => (string) ($app->title ?? ''),
            'created_by' => $createdBy ?? (int) ($app->user_id ?? 0) ?: null,
        ]);

        $this->pruneOldRevisions((int) $app->id);

        return $revision;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listForApp(GeneratedApp $app, int $limit = 30): array
    {
        $limit = max(1, min(100, $limit));

        return GeneratedAppsConnection::revisions()
            ->where('generated_app_id', (int) $app->id)
            ->orderByDesc('revision_number')
            ->limit($limit)
            ->get()
            ->map(fn (GeneratedAppRevision $revision): array => $this->serializeSummary($revision))
            ->all();
    }

    public function findForApp(GeneratedApp $app, int $revisionId): ?GeneratedAppRevision
    {
        if ($revisionId <= 0) {
            return null;
        }

        /** @var GeneratedAppRevision|null $revision */
        $revision = GeneratedAppsConnection::revisions()
            ->where('generated_app_id', (int) $app->id)
            ->whereKey($revisionId)
            ->first();

        return $revision;
    }

    /**
     * 선택한 리비전 HTML 로 앱을 되돌리고, restore 소스 스냅샷을 남긴다.
     *
     * @return array{app: GeneratedApp, revision: GeneratedAppRevision|null}
     */
    public function restore(GeneratedApp $app, int $revisionId, ?int $actorUserId = null): array
    {
        $revision = $this->findForApp($app, $revisionId);
        if ($revision === null) {
            return ['app' => $app, 'revision' => null];
        }

        $hardened = $this->htmlService->harden((string) $revision->html);
        $nextVersion = max(1, (int) ($app->version ?? 1)) + 1;

        $app->forceFill([
            'html' => $hardened,
            'version' => $nextVersion,
        ])->save();

        $fresh = $app->fresh() ?? $app;
        $snapshot = $this->snapshot(
            $fresh,
            self::SOURCE_RESTORE,
            $actorUserId ?? (int) ($app->user_id ?? 0) ?: null,
        );

        return ['app' => $fresh, 'revision' => $snapshot];
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeSummary(GeneratedAppRevision $revision): array
    {
        return [
            'id' => (int) $revision->id,
            'generated_app_id' => (int) $revision->generated_app_id,
            'revision_number' => (int) $revision->revision_number,
            'source' => (string) $revision->source,
            'html_hash' => (string) $revision->html_hash,
            'title' => (string) ($revision->title ?? ''),
            'created_by' => $revision->created_by !== null ? (int) $revision->created_by : null,
            'created_at' => $revision->created_at?->toISOString(),
            'updated_at' => $revision->updated_at?->toISOString(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function serializeDetail(GeneratedAppRevision $revision): array
    {
        return [
            ...$this->serializeSummary($revision),
            'html' => (string) $revision->html,
        ];
    }

    private function latestRevision(int $appId): ?GeneratedAppRevision
    {
        /** @var GeneratedAppRevision|null $revision */
        $revision = GeneratedAppsConnection::revisions()
            ->where('generated_app_id', $appId)
            ->orderByDesc('revision_number')
            ->first();

        return $revision;
    }

    private function pruneOldRevisions(int $appId): void
    {
        $keepIds = GeneratedAppsConnection::revisions()
            ->where('generated_app_id', $appId)
            ->orderByDesc('revision_number')
            ->limit(self::MAX_REVISIONS_PER_APP)
            ->pluck('id')
            ->all();

        if ($keepIds === []) {
            return;
        }

        GeneratedAppsConnection::revisions()
            ->where('generated_app_id', $appId)
            ->whereNotIn('id', $keepIds)
            ->delete();
    }

    private function normalizeSource(string $source): string
    {
        return match ($source) {
            self::SOURCE_RESTORE, self::SOURCE_PATCH, self::SOURCE_IMPORT => $source,
            default => self::SOURCE_SAVE,
        };
    }
}
