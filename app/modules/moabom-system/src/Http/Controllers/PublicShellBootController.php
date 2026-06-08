<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\Controllers;

use App\Extension\HookManager;
use App\Helpers\ResponseHelper;
use App\Services\TemplateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Modules\Moabom\Social\Auth\Services\SocialAuthService;
use Modules\Moabom\System\Experience\TenantExperienceDefaultsReader;
use Modules\Moabom\System\Http\Requests\Public\GetMoabomShellTemplateRoutesRequest;
use Modules\Moabom\System\Services\MoabomShellRoutesFilter;
use Modules\Moabom\System\Support\MoabomPublicApiCache;
use Modules\Moabom\System\Support\MoabomPublicApiCacheKeys;
use Modules\Moabom\System\Support\MoabomUiLocales;

/**
 * 홈 셸 최초 부트용 통합 API — frontend-defaults + shell routes + social providers.
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
        SocialAuthService $socialAuthService,
    ): JsonResponse {
        $identifier = $request->resolvedTemplate();
        $scope = $request->resolvedScope();
        $revision = $defaultsReader->combinedRevision();

        return MoabomPublicApiCache::remember(
            MoabomPublicApiCacheKeys::shellBoot($identifier, $scope, $revision),
            function () use (
                $identifier,
                $scope,
                $revision,
                $defaultsReader,
                $templateService,
                $shellRoutesFilter,
                $socialAuthService,
            ): JsonResponse {
                $routesPayload = $this->resolveShellRoutesPayload(
                    $identifier,
                    $templateService,
                    $shellRoutesFilter,
                );

                if ($routesPayload instanceof JsonResponse) {
                    return $routesPayload;
                }

                return ResponseHelper::moduleSuccess(
                    'moabom-system',
                    'messages.public_shell_boot.fetch_success',
                    [
                        'defaults' => $defaultsReader->frontendDefaults(),
                        'defaults_revision' => $revision,
                        'site' => $defaultsReader->siteMeta(),
                        'locale_catalog' => MoabomUiLocales::catalog(),
                        'shell_routes' => $routesPayload,
                        'social_providers' => $socialAuthService->enabledProviders(),
                        // 앱 SDK (Phase 4) — 활성 모듈 app.json 집계. moabom-apps 가 필터로 기여하며
                        // 미설치/비활성이면 [] (무손상). moabom-system 은 moabom-apps 를 직접 의존하지 않음.
                        'apps' => array_values((array) HookManager::applyFilters(
                            'moabom.shell_boot.apps',
                            [],
                            $identifier,
                        )),
                    ],
                );
            },
        );
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
