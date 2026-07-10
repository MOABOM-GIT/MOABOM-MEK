<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Moabom\Apps\Enums\AppTier;
use Modules\Moabom\Apps\Services\AiAppService;
use Modules\Moabom\Apps\Services\GeneratedAppHostingService;

/**
 * 소유자용 Hosted 데이터 콘솔 API — preview_token 경로와 분리.
 */
class GeneratedAppOwnerDataController extends AuthBaseController
{
    public function __construct(
        private readonly AiAppService $aiAppService,
        private readonly GeneratedAppHostingService $hostingService,
    ) {
        parent::__construct();
    }

    public function tables(int $id): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $app = $this->aiAppService->findForUser($user->id, $id);
        if ($app === null) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.not_found',
                404
            );
        }

        if (! $this->isHosted($app->tier ?? null)) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.data_not_hosted',
                422
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.data_tables_success',
            ['tables' => $this->hostingService->listTableKeysForOwner($app)]
        );
    }

    public function index(Request $request, int $id, string $tableKey): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $app = $this->aiAppService->findForUser($user->id, $id);
        if ($app === null) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.not_found',
                404
            );
        }

        if (! $this->isHosted($app->tier ?? null)) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.data_not_hosted',
                422
            );
        }

        if (! $this->isValidTableKey($tableKey)) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.not_found',
                404
            );
        }

        $limit = max(1, min(500, (int) $request->query('limit', 200)));

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.data_rows_success',
            [
                'table_key' => $tableKey,
                'rows' => $this->hostingService->listRowsForOwner($app, $tableKey, $limit),
            ]
        );
    }

    public function destroy(int $id, string $tableKey, int $rowId): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $app = $this->aiAppService->findForUser($user->id, $id);
        if ($app === null) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.not_found',
                404
            );
        }

        if (! $this->isHosted($app->tier ?? null)) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.data_not_hosted',
                422
            );
        }

        if (! $this->isValidTableKey($tableKey)) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.not_found',
                404
            );
        }

        $deleted = $this->hostingService->deleteRowForOwner($app, $tableKey, $rowId);
        if (! $deleted) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.not_found',
                404
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.data_row_delete_success',
            ['id' => $rowId, 'table_key' => $tableKey]
        );
    }

    public function export(int $id): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $app = $this->aiAppService->findForUser($user->id, $id);
        if ($app === null) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.not_found',
                404
            );
        }

        if (! $this->isHosted($app->tier ?? null)) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.data_not_hosted',
                422
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.data_export_success',
            $this->hostingService->exportForOwner($app)
        );
    }

    private function isHosted(mixed $tier): bool
    {
        return AppTier::tryFrom((string) ($tier ?? AppTier::Standard->value)) === AppTier::Hosted;
    }

    private function isValidTableKey(string $tableKey): bool
    {
        return (bool) preg_match('/^[A-Za-z0-9_-]{1,64}$/', $tableKey);
    }
}
