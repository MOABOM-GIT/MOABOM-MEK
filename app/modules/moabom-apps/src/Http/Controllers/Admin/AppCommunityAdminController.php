<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Http\Controllers\Admin;

use App\Helpers\PermissionHelper;
use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AdminBaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Moabom\Apps\Http\Requests\Admin\UpdateAppCommunityPostStatusRequest;
use Modules\Moabom\Apps\Services\AppCommunityAdminService;
use Modules\Moabom\Apps\Support\GeneratedAppAdminScope;

/**
 * 앱 이야기 admin API — GeneratedAppAdminScope 공통.
 */
final class AppCommunityAdminController extends AdminBaseController
{
    public function __construct(
        private readonly AppCommunityAdminService $adminService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $scope = GeneratedAppAdminScope::fromRequest();
        $payload = $this->adminService->list($scope, $request->query());
        $payload['meta']['abilities'] = array_merge(
            (array) ($payload['meta']['abilities'] ?? []),
            [
                'can_manage' => PermissionHelper::check('moabom-apps.community.manage', $request->user()),
            ],
        );

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.admin.community.list_success',
            $payload,
        );
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $scope = GeneratedAppAdminScope::fromRequest();

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.admin.community.show_success',
            [
                'item' => $this->adminService->show($id, $scope),
                'meta' => $scope->listMeta(),
            ],
        );
    }

    public function updateStatus(UpdateAppCommunityPostStatusRequest $request, int $id): JsonResponse
    {
        $scope = GeneratedAppAdminScope::fromRequest();

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.admin.community.status_success',
            [
                'item' => $this->adminService->updateStatus(
                    $id,
                    $scope,
                    $request->status(),
                    $request->hiddenReason(),
                ),
            ],
        );
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $scope = GeneratedAppAdminScope::fromRequest();
        $this->adminService->destroy($id, $scope);

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.admin.community.delete_success',
            ['deleted_id' => $id],
        );
    }
}
