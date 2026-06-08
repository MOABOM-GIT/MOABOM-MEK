<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 이용약관·개인정보처리방침 — tenant DB 우선, 없으면 platform(moabom-db) 발행본 fallback.
 */
final class TenantLegalPageReader
{
    /** @var list<string> */
    public const LEGAL_SLUGS = ['terms', 'privacy'];

    public function isLegalSlug(string $slug): bool
    {
        return in_array($slug, self::LEGAL_SLUGS, true);
    }

    /**
     * @return array<string, mixed>|null PublicPageResource 호환 payload
     */
    public function publishedPayload(string $slug): ?array
    {
        if (! $this->isLegalSlug($slug) || ! Schema::hasTable('pages')) {
            return null;
        }

        $pdo = DB::connection()->getPdo();
        $currentDb = (string) DB::connection()->getDatabaseName();

        $row = $this->findPublishedRow($pdo, $currentDb, $slug);
        if ($row === null) {
            $sourceDb = (string) config('moabom-system.saas.provision.schema_source_db', 'moabom-db');
            if ($sourceDb !== '' && $sourceDb !== $currentDb) {
                $row = $this->findPublishedRow($pdo, $sourceDb, $slug);
            }
        }

        return $row !== null ? $this->toPayload($row) : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findPublishedRow(\PDO $pdo, string $database, string $slug): ?array
    {
        $prefix = (string) DB::connection()->getTablePrefix();
        $pagesTable = $prefix.'pages';

        try {
            $stmt = $pdo->prepare(
                "SELECT * FROM `{$database}`.`{$pagesTable}` WHERE `slug` = ? AND `published` = 1 AND `deleted_at` IS NULL LIMIT 1"
            );
            $stmt->execute([$slug]);
            $row = $stmt->fetch(\PDO::FETCH_ASSOC);

            return is_array($row) ? $row : null;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    private function toPayload(array $row): array
    {
        $locale = app()->getLocale();
        $fallback = (string) config('app.fallback_locale', 'ko');

        return [
            'id' => (int) ($row['id'] ?? 0),
            'slug' => (string) ($row['slug'] ?? ''),
            'title' => $this->localizedField($row['title'] ?? null, $locale, $fallback),
            'content' => $this->localizedField($row['content'] ?? null, $locale, $fallback),
            'content_mode' => (string) ($row['content_mode'] ?? 'html'),
            'published_at' => $row['published_at'] ?? null,
            'seo_meta' => $this->decodeJson($row['seo_meta'] ?? null),
            'current_version' => isset($row['current_version']) ? (int) $row['current_version'] : null,
            'attachments' => [],
        ];
    }

    private function localizedField(mixed $value, string $locale, string $fallback): string
    {
        if (is_string($value) && $value !== '' && str_starts_with(trim($value), '{')) {
            $decoded = json_decode($value, true);
            if (is_array($decoded)) {
                $value = $decoded;
            }
        }

        if (is_array($value)) {
            $picked = $value[$locale] ?? $value[$fallback] ?? null;
            if (is_string($picked) && $picked !== '') {
                return $picked;
            }

            foreach ($value as $candidate) {
                if (is_string($candidate) && $candidate !== '') {
                    return $candidate;
                }
            }

            return '';
        }

        return is_string($value) ? $value : '';
    }

    /**
     * @return array<string, mixed>|null
     */
    private function decodeJson(mixed $value): ?array
    {
        if (is_array($value)) {
            return $value;
        }

        if (! is_string($value) || $value === '') {
            return null;
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : null;
    }
}
