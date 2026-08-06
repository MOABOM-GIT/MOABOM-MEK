<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\DB;

/**
 * module/plugin 상태 캐시의 tenant별 DB revision.
 *
 * Core cache key는 고정 문자열이므로 decorator가 이 revision을 붙여
 * file cache를 사용하는 Cloud Run 인스턴스 사이에서도 상태 변경을 감지한다.
 */
final class TenantExtensionRevisionResolver
{
    private ?string $memoScope = null;

    private ?string $memoRevision = null;

    public function __construct(
        private readonly TenantContext $tenantContext,
    ) {}

    public function current(): string
    {
        $scope = $this->tenantContext->isPlatformRequest()
            ? 'platform'
            : ($this->tenantContext->tenantId() ?? '_unknown');

        if ($this->memoScope === $scope && $this->memoRevision !== null) {
            return $this->memoRevision;
        }

        try {
            $modules = DB::table('modules')
                ->selectRaw("'module' as extension_type")
                ->addSelect(['id', 'identifier', 'status', 'updated_at']);
            $plugins = DB::table('plugins')
                ->selectRaw("'plugin' as extension_type")
                ->addSelect(['id', 'identifier', 'status', 'updated_at']);
            $rows = $modules->unionAll($plugins)
                ->orderBy('extension_type')
                ->orderBy('id')
                ->get();

            $serialized = $rows->map(static fn (object $row): array => [
                (string) $row->extension_type,
                (string) $row->id,
                (string) $row->identifier,
                (string) $row->status,
                (string) $row->updated_at,
            ])->all();
            $revision = sha1(json_encode($serialized, JSON_UNESCAPED_UNICODE) ?: '[]');
        } catch (\Throwable) {
            // 설치 전·복구 중에는 기존 tenant scope만 유지하고 짧은 TTL/fallback에 맡긴다.
            $revision = 'unavailable';
        }

        $this->memoScope = $scope;

        return $this->memoRevision = $revision;
    }
}
