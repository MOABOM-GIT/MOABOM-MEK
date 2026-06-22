<?php

namespace Modules\Moabom\Credit\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use Illuminate\Http\JsonResponse;
use Modules\Moabom\Credit\Services\CreditService;

/**
 * 사용자 크레딧 컨트롤러
 */
class CreditController extends AuthBaseController
{
    public function __construct(
        private CreditService $creditService
    ) {
        parent::__construct();
    }

    /**
     * 현재 로그인한 사용자의 크레딧 정보를 조회합니다.
     */
    public function index(): JsonResponse
    {
        try {
            $user = $this->getCurrentUser();

            if (! $user) {
                return ResponseHelper::unauthorized('auth.unauthenticated');
            }

            $this->logApiUsage('moabom-credit.user.credits.index');

            $limit = max(1, min(50, (int) request()->query('limit', 8)));
            $offset = max(0, (int) request()->query('offset', 0));

            return ResponseHelper::moduleSuccess(
                'moabom-credit',
                'messages.fetch_success',
                $this->creditService->getUserCreditOverview($user, $limit, $offset)
            );
        } catch (\Exception $e) {
            return ResponseHelper::moduleError(
                'moabom-credit',
                'messages.fetch_failed',
                500
            );
        }
    }

    /**
     * 현재 로그인한 사용자의 출석체크 크레딧을 적립합니다.
     */
    public function attendance(): JsonResponse
    {
        try {
            $user = $this->getCurrentUser();

            if (! $user) {
                return ResponseHelper::unauthorized('auth.unauthenticated');
            }

            $this->logApiUsage('moabom-credit.user.attendance');

            return ResponseHelper::moduleSuccess(
                'moabom-credit',
                'messages.attendance.success',
                $this->creditService->checkAttendance($user),
            );
        } catch (\InvalidArgumentException $e) {
            return ResponseHelper::moduleError(
                'moabom-credit',
                'messages.attendance.failed',
                409,
                ['message' => $e->getMessage()]
            );
        } catch (\Exception $e) {
            return ResponseHelper::moduleError(
                'moabom-credit',
                'messages.attendance.failed',
                500
            );
        }
    }
}
