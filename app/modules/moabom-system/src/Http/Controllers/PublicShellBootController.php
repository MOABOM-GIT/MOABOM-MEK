<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\Controllers;

use App\Extension\HookManager;
use App\Helpers\ResponseHelper;
use App\Services\TemplateService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Modules\Moabom\System\Experience\TenantExperienceDefaultsReader;
use Modules\Moabom\System\Http\Requests\Public\GetMoabomShellTemplateRoutesRequest;
use Modules\Moabom\System\Services\MoabomShellRoutesFilter;
use Modules\Moabom\System\Services\Shell\MoabomShellCriticalSnapshot;
use Modules\Moabom\System\Services\Shell\ShellUsageIngestGuard;
use Modules\Moabom\System\Support\MoabomPublicApiCache;
use Modules\Moabom\System\Support\MoabomPublicApiCacheKeys;
use Modules\Moabom\System\Support\MoabomUiLocales;

/**
 * 홈 셸 최초 부트용 통합 API — frontend-defaults + shell routes + social providers + critical snapshot.
 *
 * @see deploy/CLOUD-RUN-PERFORMANCE.md (P1: API N회 → 1회)
 */
final class PublicShellBootController extends Controller
{
    public function __invoke(
        GetMoabomShellTemplateRoutesRequest $request,
        TenantExperienceDefaultsReader $defaultsReader,
        TemplateService $templateService,
        MoabomShellRoutesFilter $shellRoutesFilter,
        ShellUsageIngestGuard $usageIngestGuard,
        MoabomShellCriticalSnapshot $criticalSnapshot,
    ): JsonResponse {
        $identifier = $request->resolvedTemplate();
        $scope = $request->resolvedScope();
        $revision = $defaultsReader->combinedRevision();

        try {
            /** @var array<string, mixed> $payload */
            $payload = MoabomPublicApiCache::rememberShared(
                MoabomPublicApiCacheKeys::shellBoot($identifier, $scope, $revision),
                MoabomPublicApiCacheKeys::shellBootSharedObject($identifier, $scope),
                function () use (
                    $identifier,
                    $defaultsReader,
                    $revision,
                    $templateService,
                    $shellRoutesFilter,
                    $criticalSnapshot,
                ): array {
                    $routesPayload = $this->resolveShellRoutesPayload(
                        $identifier,
                        $templateService,
                        $shellRoutesFilter,
                    );

                    if ($routesPayload instanceof JsonResponse) {
                        throw new HttpResponseException($routesPayload);
                    }

                    $critical = $criticalSnapshot->buildConfigHomeOnly($identifier);

                    return [
                        'defaults' => $defaultsReader->frontendDefaults(),
                        'defaults_revision' => $revision,
                        'site' => $defaultsReader->siteMeta(),
                        'locale_catalog' => MoabomUiLocales::catalog(),
                        'shell_routes' => $routesPayload,
                        'social_providers' => array_values((array) HookManager::applyFilters(
                            'moabom.shell_boot.social_providers',
                            [],
                            $identifier,
                        )),
                        'apps' => array_values((array) HookManager::applyFilters(
                            'moabom.shell_boot.apps',
                            [],
                            $identifier,
                        )),
                        // routes 는 shell_routes 키 SSOT — critical 에서 재계산하지 않는다.
                        'critical' => $critical,
                    ];
                },
            );
        } catch (HttpResponseException $exception) {
            $response = $exception->getResponse();
            if ($response instanceof JsonResponse) {
                return $response;
            }

            throw $exception;
        }

        $payload['shell_rankings'] = $usageIngestGuard->bootPayload();

        $ttl = MoabomPublicApiCache::ttlSeconds();
        $response = ResponseHelper::moduleSuccess(
            'moabom-system',
            'messages.public_shell_boot.fetch_success',
            $payload,
        );

        // SW StaleWhileRevalidate가 no-store·private 응답은 캐시하지 못하므로 public 캐시를 허용한다.
        // 공개 부트 스냅샷은 TTL 동안 public 캐시 허용 (revision 키로 무효화).
        if ($ttl > 0) {
            $response->headers->set(
                'Cache-Control',
                sprintf('public, max-age=%d, s-maxage=%d', $ttl, $ttl),
            );
        }

        return $response;
    }

    /**
     * @return array{version?: string, routes?: array<int, array<string, mixed>>}|JsonResponse
     */
    private function resolveShellRoutesPayload(
        string $identifier,
        TemplateService $templateService,
        MoabomShellRoutesFilter $shellRoutesFilter,
    ): array|JsonResponse {
        $result = $templateService->getRoutesDataWithModules($identifier);

        if (! $result['success']) {
            $error = $result['error'] ?? 'unknown_error';

            return match ($error) {
                'template_not_found' => ResponseHelper::moduleError(
                    'moabom-system',
                    'messages.shell_routes.template_not_found',
                    404,
                    null,
                    ['template' => $identifier],
                ),
                'routes_not_found' => ResponseHelper::moduleError(
                    'moabom-system',
                    'messages.shell_routes.routes_not_found',
                    404,
                ),
                'invalid_json' => ResponseHelper::moduleError(
                    'moabom-system',
                    'messages.shell_routes.invalid_json',
                    500,
                ),
                default => ResponseHelper::moduleError(
                    'moabom-system',
                    'messages.shell_routes.unknown_error',
                    500,
                ),
            };
        }

        /** @var array{version?: string, routes?: array<int, array<string, mixed>>} $data */
        $data = $result['data'];
        $data['routes'] = $shellRoutesFilter->filterForShell($data['routes'] ?? [], $identifier);

        return $data;
    }
}
