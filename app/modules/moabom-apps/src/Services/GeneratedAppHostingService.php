<?php

namespace Modules\Moabom\Apps\Services;

use App\Contracts\Extension\StorageInterface;
use Modules\Moabom\Apps\Enums\AppTier;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Models\GeneratedAppRow;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Modules\Moabom\Apps\Support\GeneratedAppDataScope;
use Modules\Moabom\Apps\Support\GeneratedAppPreviewRouting;

/**
 * Hosted 티어 프로비저닝·삭제 시 row·스토리지 정리.
 */
class GeneratedAppHostingService
{
    private const STORAGE_CATEGORY = 'generated-apps';

    public function __construct(
        private readonly StorageInterface $storage,
    ) {
    }

    public function provisionHosted(GeneratedApp $app): GeneratedApp
    {
        $label = GeneratedAppPreviewRouting::usesTenantPath()
            ? 'hosted/'.$app->id
            : (string) $app->id;
        $prefix = 'generated-apps/'.$app->id.'/';

        $app->forceFill([
            'tier' => AppTier::Hosted->value,
            'hosted_subdomain' => $label,
            'storage_prefix' => $prefix,
            'provision_status' => 'ready',
            'provisioned_at' => now(),
        ])->save();

        // platform plane: users 는 tenant DB — fresh(['user']) 시 moabom-platform.users 조회로 500
        return $app->fresh() ?? $app;
    }

    public function teardownHosted(GeneratedApp $app): void
    {
        if (AppTier::tryFrom((string) ($app->tier ?? AppTier::Standard->value)) !== AppTier::Hosted) {
            return;
        }

        GeneratedAppsConnection::rows()
            ->where('generated_app_id', $app->id)
            ->delete();

        $directory = (string) $app->id;
        if ($directory !== '') {
            $this->storage->deleteDirectory(self::STORAGE_CATEGORY, $directory);
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listRows(GeneratedApp $app, string $tableKey, GeneratedAppDataScope $scope): array
    {
        return $this->scopedRows($app, $tableKey, $scope)
            ->latest('id')
            ->get()
            ->map(static fn (GeneratedAppRow $row): array => self::serializeRow($row))
            ->all();
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function createRow(
        GeneratedApp $app,
        string $tableKey,
        array $payload,
        GeneratedAppDataScope $scope,
    ): array {
        $row = GeneratedAppsConnection::rows()->create([
            'generated_app_id' => $app->id,
            'tenant_slug' => $scope->tenantSlug,
            'user_id' => $scope->userId,
            'table_key' => $tableKey,
            'payload' => $payload,
        ]);

        return self::serializeRow($row);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>|null
     */
    public function updateRow(
        GeneratedApp $app,
        int $rowId,
        string $tableKey,
        array $payload,
        GeneratedAppDataScope $scope,
    ): ?array {
        $row = $this->scopedRows($app, $tableKey, $scope)
            ->whereKey($rowId)
            ->first();

        if ($row === null) {
            return null;
        }

        $row->update(['payload' => $payload]);

        return self::serializeRow($row->fresh() ?? $row);
    }

    public function deleteRow(
        GeneratedApp $app,
        int $rowId,
        string $tableKey,
        GeneratedAppDataScope $scope,
    ): bool {
        return $this->scopedRows($app, $tableKey, $scope)
            ->whereKey($rowId)
            ->delete() > 0;
    }

    /**
     * 소유자 데이터 콘솔 — 앱의 table_key 목록(스코프 무시, 앱 단위).
     *
     * @return list<array{table_key: string, row_count: int}>
     */
    public function listTableKeysForOwner(GeneratedApp $app): array
    {
        $rows = GeneratedAppsConnection::rows()
            ->where('generated_app_id', $app->id)
            ->selectRaw('table_key, COUNT(*) as row_count')
            ->groupBy('table_key')
            ->orderBy('table_key')
            ->get();

        return $rows->map(static fn ($row): array => [
            'table_key' => (string) $row->table_key,
            'row_count' => (int) $row->row_count,
        ])->all();
    }

    /**
     * 소유자 데이터 콘솔 — table_key 전체 행(소유자 스코프: 앱 전체).
     *
     * @return list<array<string, mixed>>
     */
    public function listRowsForOwner(GeneratedApp $app, string $tableKey, int $limit = 200): array
    {
        $limit = max(1, min(500, $limit));

        return GeneratedAppsConnection::rows()
            ->where('generated_app_id', $app->id)
            ->where('table_key', $tableKey)
            ->latest('id')
            ->limit($limit)
            ->get()
            ->map(static fn (GeneratedAppRow $row): array => self::serializeRow($row))
            ->all();
    }

    public function deleteRowForOwner(GeneratedApp $app, string $tableKey, int $rowId): bool
    {
        return GeneratedAppsConnection::rows()
            ->where('generated_app_id', $app->id)
            ->where('table_key', $tableKey)
            ->whereKey($rowId)
            ->delete() > 0;
    }

    /**
     * @return array{tables: list<array{table_key: string, row_count: int}>, rows: array<string, list<array<string, mixed>>>}
     */
    public function exportForOwner(GeneratedApp $app, int $perTableLimit = 200): array
    {
        $tables = $this->listTableKeysForOwner($app);
        $rowsByTable = [];
        foreach ($tables as $table) {
            $key = $table['table_key'];
            $rowsByTable[$key] = $this->listRowsForOwner($app, $key, $perTableLimit);
        }

        return [
            'tables' => $tables,
            'rows' => $rowsByTable,
        ];
    }

  /**
     * @return \Illuminate\Database\Eloquent\Builder<GeneratedAppRow>
     */
    private function scopedRows(GeneratedApp $app, string $tableKey, GeneratedAppDataScope $scope)
    {
        return GeneratedAppsConnection::rows()
            ->where('generated_app_id', $app->id)
            ->where('table_key', $tableKey)
            ->where('tenant_slug', $scope->tenantSlug)
            ->where('user_id', $scope->userId);
    }

    /**
     * @return array<string, mixed>
     */
    private static function serializeRow(GeneratedAppRow $row): array
    {
        return [
            'id' => $row->id,
            'table_key' => $row->table_key,
            'payload' => $row->payload ?? [],
            'user_id' => $row->user_id,
            'tenant_slug' => $row->tenant_slug,
            'created_at' => $row->created_at?->toISOString(),
            'updated_at' => $row->updated_at?->toISOString(),
        ];
    }
}
