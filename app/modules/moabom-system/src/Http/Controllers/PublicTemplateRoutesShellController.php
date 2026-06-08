<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Services\TemplateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Modules\Moabom\System\Http\Requests\Public\GetMoabomShellTemplateRoutesRequest;
use Modules\Moabom\System\Services\MoabomShellRoutesFilter;
use Modules\Moabom\System\Support\MoabomPublicApiCache;
use Modules\Moabom\System\Support\MoabomPublicApiCacheKeys;

/**
 * 셸 최초 부트용 축소 라우트 JSON (코어 `routes.json` 스키마 호환).
 *
 * @see docs/moabom-routes-ghost-api.md
 */
final class PublicTemplateRoutesShellController extends Controller
{
    public function __invoke(
        GetMoabomShellTemplateRoutesRequest $request,
        TemplateService $templateService,
        MoabomShellRoutesFilter $shellRoutesFilter,
    ): JsonResponse {
        $identifier = $request->resolvedTemplate();
        $scope = $request->resolvedScope();
        $routesVersion = MoabomPublicApiCacheKeys::templateRoutesVersionToken($identifier);

        return MoabomPublicApiCache::remember(
            MoabomPublicApiCacheKeys::templateRoutesShell($identifier, $scope, $routesVersion),
            function () use ($request, $identifier, $scope, $templateService, $shellRoutesFilter): JsonResponse {
                return $this->buildResponse($identifier, $scope, $templateService, $shellRoutesFilter);
            },
        );
    }

    private function buildResponse(
        string $identifier,
        string $scope,
        TemplateService $templateService,
        MoabomShellRoutesFilter $shellRoutesFilter,
    ): JsonResponse {
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

        if ($scope === 'shell') {
            $data['routes'] = $shellRoutesFilter->filterForShell($data['routes'] ?? [], $identifier);
        }

        return ResponseHelper::moduleSuccess(
            'moabom-system',
            'messages.shell_routes.fetch_success',
            $data,
        );
    }
}
