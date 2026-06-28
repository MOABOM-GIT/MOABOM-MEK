<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Http\Controllers\Admin;

use App\Helpers\PermissionHelper;
use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AdminBaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Moabom\Apps\Http\Requests\Admin\UpdateGeneratedAppVisibilityRequest;
use Modules\Moabom\Apps\Services\GeneratedAppAdminService;
use Modules\Moabom\Apps\Services\GeneratedAppPurgeService;
use Modules\Moabom\Apps\Support\GeneratedAppAdminScope;

/**
 * AI 생성앱 admin API — 마스터·업체 Host 공통, scope 만 분기.
 */
final class GeneratedAppAdminController extends AdminBaseController
{
    public function __construct(
        private readonly GeneratedAppAdminService $adminService,
        private readonly GeneratedAppPurgeService $purgeService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $scope = GeneratedAppAdminScope::fromRequest();
        $payload = $this->adminService->list($scope, $request->query());
        $payload['meta']['abilities'] = array_merge(
            (array) ($payload['meta']['abilities'] ?? []),
            [
                'can_manage' => PermissionHelper::check('moabom-apps.generated.manage', $request->user()),
            ],
        );

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.admin.generated.list_success',
            $payload,
        );
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $scope = GeneratedAppAdminScope::fromRequest();
        $app = $this->adminService->findManagedOrFail($id, $scope);

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.admin.generated.show_success',
            [
                'item' => $this->adminService->show($app, $scope),
                'meta' => $scope->listMeta(),
            ],
        );
    }

    public function updateVisibility(UpdateGeneratedAppVisibilityRequest $request, int $id): JsonResponse
    {
        $scope = GeneratedAppAdminScope::fromRequest();
        $app = $this->adminService->findManagedOrFail($id, $scope);
        $updated = $this->adminService->setVisibility($app, $scope, $request->visibility());

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.admin.generated.visibility_success',
            [
                'item' => $this->adminService->show($updated, $scope),
            ],
        );
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $scope = GeneratedAppAdminScope::fromRequest();
        $app = $this->adminService->findManagedOrFail($id, $scope);
        $this->purgeService->purge($app, $scope);

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.admin.generated.delete_success',
            ['deleted_id' => $id],
        );
    }
}
