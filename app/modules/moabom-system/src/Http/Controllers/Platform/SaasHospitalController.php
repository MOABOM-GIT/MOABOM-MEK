<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\Controllers\Platform;

use App\Helpers\ResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Http\Requests\Platform\DestroySaasHospitalRequest;
use Modules\Moabom\System\Http\Requests\Platform\PurgeSaasHospitalRequest;
use Modules\Moabom\System\Http\Requests\Platform\StoreSaasHospitalRequest;
use Modules\Moabom\System\Saas\Deprovision\DestroyOptions;
use Modules\Moabom\System\Saas\Deprovision\PurgeOptions;
use Modules\Moabom\System\Saas\Deprovision\TenantDeprovisionerInterface;
use Modules\Moabom\System\Saas\Deprovision\TenantOperationLogger;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\TenantPackageCatalog;
use Modules\Moabom\System\Saas\TenantProvisionerInterface;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Saas\TenantRegistry;
use Modules\Moabom\System\Saas\Usage\TenantUsageReporter;

/**
 * mek360.com 전용 — 업체 SaaS 프로비저닝·정리 API.
 */
final class SaasHospitalController extends Controller
{
    public function __construct(
        private readonly PlatformConnectionFactory $platformConnections,
        private readonly TenantRegistry $registry,
        private readonly TenantProvisionerInterface $provisioner,
        private readonly TenantPackageCatalog $packageCatalog,
        private readonly TenantUsageReporter $usageReporter,
        private readonly TenantDeprovisionerInterface $deprovisioner,
        private readonly TenantOperationLogger $operationLogger,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->platformConnections->registerConnection();

        $columns = ['slug', 'host', 'db_database', 'gcs_prefix', 'package_id', 'status', 'app_url', 'created_at', 'updated_at'];
        foreach (['display_name', 'region', 'address'] as $optional) {
            if (Schema::connection('moabom_platform')->hasColumn('moabom_saas_tenants', $optional)) {
                $columns[] = $optional;
            }
        }

        $rows = DB::connection('moabom_platform')
            ->table('moabom_saas_tenants')
            ->orderByDesc('created_at')
            ->orderBy('slug')
            ->get($columns);

        $baseDomain = (string) config('moabom-system.saas.base_domain', 'mek360.com');
        $platformHosts = array_values(array_filter(array_map(
            'strval',
            (array) config('moabom-system.saas.platform_hosts', []),
        )));

        $includeUsage = filter_var($request->query('include_usage', true), FILTER_VALIDATE_BOOLEAN);
        $includeStorage = filter_var($request->query('include_storage', true), FILTER_VALIDATE_BOOLEAN);

        $hospitals = $rows->map(function ($row) use ($platformHosts, $includeUsage, $includeStorage): array {
            $host = (string) ($row->host ?? '');
            $appUrl = (string) ($row->app_url ?? '');
            if ($appUrl === '' && $host !== '') {
                $appUrl = 'https://'.$host;
            }

            $tenant = TenantRecord::fromRow((array) $row);

            $item = [
                'slug' => (string) ($row->slug ?? ''),
                'host' => $host,
                'display_name' => isset($row->display_name) ? (string) $row->display_name : null,
                'region' => isset($row->region) ? (string) $row->region : null,
                'note' => isset($row->region) ? (string) $row->region : null,
                'address' => isset($row->address) ? (string) $row->address : null,
                'db_database' => (string) ($row->db_database ?? ''),
                'gcs_prefix' => (string) ($row->gcs_prefix ?? ''),
                'package_id' => (string) ($row->package_id ?? ''),
                'status' => (string) ($row->status ?? ''),
                'app_url' => $appUrl,
                'created_at' => $row->created_at,
                'updated_at' => $row->updated_at,
                'is_platform_host' => in_array($host, $platformHosts, true),
            ];

            if ($includeUsage && ! $tenant->isPlatformHost() && $tenant->isActive()) {
                try {
                    $summary = $this->usageReporter->measureSummary($tenant, $includeStorage);
                    $item['usage'] = $summary;
                } catch (\Throwable) {
                    $item['usage'] = null;
                }
            }

            return $item;
        })->values();

        return ResponseHelper::moduleSuccess(
            'moabom-system',
            'messages.saas.hospitals.list_success',
            [
                'hospitals' => $hospitals,
                'meta' => [
                    'base_domain' => $baseDomain,
                    'platform_hosts' => $platformHosts,
                    'total' => $hospitals->count(),
                    'supports_display_columns' => Schema::connection('moabom_platform')->hasColumn('moabom_saas_tenants', 'display_name'),
                    'includes_usage' => $includeUsage,
                    'includes_storage' => $includeStorage,
                ],
            ],
        );
    }

    public function packages(): JsonResponse
    {
        $ids = $this->packageCatalog->listIds();
        $packages = [];
        foreach ($ids as $id) {
            try {
                $package = $this->packageCatalog->get($id);
                $packages[] = [
                    'id' => $package->id,
                    'label' => $package->label,
                    'templates' => $package->templates,
                    'active_user_template' => $package->activeUserTemplate,
                    'active_admin_template' => $package->activeAdminTemplate,
                ];
            } catch (\Throwable) {
                continue;
            }
        }

        return ResponseHelper::moduleSuccess(
            'moabom-system',
            'messages.saas.hospitals.packages_success',
            ['packages' => $packages],
        );
    }

    public function show(string $slug): JsonResponse
    {
        $tenant = $this->registry->findBySlug(strtolower($slug));
        if ($tenant === null) {
            return ResponseHelper::moduleError(
                'moabom-system',
                'messages.saas.hospitals.not_found',
                404,
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-system',
            'messages.saas.hospitals.show_success',
            [
                'hospital' => [
                    'slug' => $tenant->slug,
                    'host' => $tenant->host,
                    'display_name' => $tenant->displayName,
                    'region' => $tenant->region,
                    'note' => $tenant->note(),
                    'address' => $tenant->address,
                    'database' => $tenant->dbDatabase,
                    'gcs_prefix' => $tenant->gcsPrefix,
                    'package_id' => $tenant->packageId,
                    'status' => $tenant->status,
                    'app_url' => $tenant->appUrl,
                    'is_platform_host' => $tenant->isPlatformHost(),
                ],
            ],
        );
    }

    public function usage(string $slug): JsonResponse
    {
        $tenant = $this->registry->findBySlug(strtolower($slug));
        if ($tenant === null) {
            return ResponseHelper::moduleError('moabom-system', 'messages.saas.hospitals.not_found', 404);
        }

        try {
            $measurement = $this->usageReporter->measure($tenant);
        } catch (\Throwable $e) {
            return ResponseHelper::moduleError(
                'moabom-system',
                'messages.saas.hospitals.usage_failed',
                500,
                $e->getMessage(),
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-system',
            'messages.saas.hospitals.usage_success',
            $measurement,
        );
    }

    public function purge(PurgeSaasHospitalRequest $request, string $slug): JsonResponse
    {
        $tenant = $this->registry->findBySlug(strtolower($slug));
        if ($tenant === null) {
            return ResponseHelper::moduleError('moabom-system', 'messages.saas.hospitals.not_found', 404);
        }

        $mode = (string) $request->validated('mode');
        $options = new PurgeOptions(
            confirmSlug: (string) $request->validated('confirm_slug'),
            actorUserId: $request->user()?->id,
        );

        try {
            $result = $mode === 'storage_data'
                ? $this->deprovisioner->purgeStorageData($tenant, $options)
                : $this->deprovisioner->purgeDbData($tenant, $options);
        } catch (\InvalidArgumentException $e) {
            return ResponseHelper::moduleError('moabom-system', 'messages.saas.hospitals.purge_validation_failed', 422, $e->getMessage());
        } catch (\RuntimeException $e) {
            return ResponseHelper::moduleError('moabom-system', 'messages.saas.hospitals.purge_failed', 409, $e->getMessage());
        }

        return ResponseHelper::moduleSuccess(
            'moabom-system',
            'messages.saas.hospitals.purge_success',
            ['result' => $result->toArray()],
        );
    }

    public function destroy(DestroySaasHospitalRequest $request, string $slug): JsonResponse
    {
        $tenant = $this->registry->findBySlug(strtolower($slug));
        if ($tenant === null) {
            return ResponseHelper::moduleError('moabom-system', 'messages.saas.hospitals.not_found', 404);
        }

        $options = new DestroyOptions(
            confirmSlug: (string) $request->validated('confirm_slug'),
            confirmHost: (string) $request->validated('confirm_host'),
            actorUserId: $request->user()?->id,
        );

        try {
            $result = $this->deprovisioner->destroy($tenant, $options);
        } catch (\InvalidArgumentException $e) {
            return ResponseHelper::moduleError('moabom-system', 'messages.saas.hospitals.destroy_validation_failed', 422, $e->getMessage());
        } catch (\RuntimeException $e) {
            return ResponseHelper::moduleError('moabom-system', 'messages.saas.hospitals.destroy_failed', 409, $e->getMessage());
        }

        return ResponseHelper::moduleSuccess(
            'moabom-system',
            'messages.saas.hospitals.destroy_success',
            ['result' => $result->toArray()],
        );
    }

    public function operation(string $slug, int $operationId): JsonResponse
    {
        $tenant = $this->registry->findBySlug(strtolower($slug));
        if ($tenant === null) {
            return ResponseHelper::moduleError('moabom-system', 'messages.saas.hospitals.not_found', 404);
        }

        $operation = $this->operationLogger->find($operationId);
        if ($operation === null || strtolower((string) $operation['slug']) !== strtolower($tenant->slug)) {
            return ResponseHelper::moduleError('moabom-system', 'messages.saas.hospitals.operation_not_found', 404);
        }

        return ResponseHelper::moduleSuccess(
            'moabom-system',
            'messages.saas.hospitals.operation_success',
            ['operation' => $operation],
        );
    }

    public function store(StoreSaasHospitalRequest $request): JsonResponse
    {
        $note = (string) ($request->validated('note') ?? $request->validated('region') ?? '');

        try {
            $result = $this->provisioner->provision(
                (string) $request->validated('slug'),
                [
                    'name' => (string) $request->validated('name'),
                    'region' => $note,
                    'note' => $note,
                    'address' => (string) ($request->validated('address') ?? ''),
                    'package' => (string) ($request->validated('package') ?? 'hospital-default'),
                    'legacy_clone' => (bool) $request->boolean('legacy_clone'),
                    'skip_clone' => (bool) $request->boolean('skip_clone'),
                    'force' => (bool) $request->boolean('force'),
                    'logo_light' => $request->file('logo_light'),
                    'logo_dark' => $request->file('logo_dark'),
                ],
            );
        } catch (\InvalidArgumentException $e) {
            return ResponseHelper::moduleError('moabom-system', 'messages.saas.hospitals.validation_failed', 422, $e->getMessage());
        } catch (\RuntimeException $e) {
            return ResponseHelper::moduleError('moabom-system', 'messages.saas.hospitals.provision_failed', 409, $e->getMessage());
        }

        return ResponseHelper::moduleSuccess(
            'moabom-system',
            'messages.saas.hospitals.created',
            ['hospital' => $result],
            201,
        );
    }
}
