<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas\Deprovision;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;

/**
 * moabom_saas_tenant_operations 감사 로그.
 */
final class TenantOperationLogger
{
    public function __construct(
        private readonly PlatformConnectionFactory $platformConnections,
    ) {}

    public function start(string $slug, string $mode, ?int $actorUserId = null): int
    {
        $this->platformConnections->registerConnection();

        if (! Schema::connection('moabom_platform')->hasTable('moabom_saas_tenant_operations')) {
            return 0;
        }

        $now = now();

        return (int) DB::connection('moabom_platform')->table('moabom_saas_tenant_operations')->insertGetId([
            'slug' => $slug,
            'mode' => $mode,
            'status' => 'running',
            'actor_user_id' => $actorUserId,
            'started_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    /**
     * @param  array<string, mixed>  $metrics
     */
    public function complete(int $operationId, array $metrics = []): void
    {
        if ($operationId <= 0) {
            return;
        }

        $this->platformConnections->registerConnection();

        if (! Schema::connection('moabom_platform')->hasTable('moabom_saas_tenant_operations')) {
            return;
        }

        DB::connection('moabom_platform')->table('moabom_saas_tenant_operations')
            ->where('id', $operationId)
            ->update([
                'status' => 'completed',
                'finished_at' => now(),
                'metrics_json' => $metrics === [] ? null : json_encode($metrics, JSON_UNESCAPED_UNICODE),
                'error' => null,
                'updated_at' => now(),
            ]);
    }

    public function fail(int $operationId, string $error): void
    {
        if ($operationId <= 0) {
            return;
        }

        $this->platformConnections->registerConnection();

        if (! Schema::connection('moabom_platform')->hasTable('moabom_saas_tenant_operations')) {
            return;
        }

        DB::connection('moabom_platform')->table('moabom_saas_tenant_operations')
            ->where('id', $operationId)
            ->update([
                'status' => 'failed',
                'finished_at' => now(),
                'error' => $error,
                'updated_at' => now(),
            ]);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function find(int $operationId): ?array
    {
        $this->platformConnections->registerConnection();

        if (! Schema::connection('moabom_platform')->hasTable('moabom_saas_tenant_operations')) {
            return null;
        }

        $row = DB::connection('moabom_platform')
            ->table('moabom_saas_tenant_operations')
            ->where('id', $operationId)
            ->first();

        if ($row === null) {
            return null;
        }

        $metrics = null;
        if (isset($row->metrics_json) && is_string($row->metrics_json)) {
            $decoded = json_decode($row->metrics_json, true);
            $metrics = is_array($decoded) ? $decoded : null;
        }

        return [
            'id' => (int) $row->id,
            'slug' => (string) $row->slug,
            'mode' => (string) $row->mode,
            'status' => (string) $row->status,
            'actor_user_id' => isset($row->actor_user_id) ? (int) $row->actor_user_id : null,
            'started_at' => $row->started_at,
            'finished_at' => $row->finished_at,
            'metrics' => $metrics,
            'error' => isset($row->error) ? (string) $row->error : null,
        ];
    }
}
