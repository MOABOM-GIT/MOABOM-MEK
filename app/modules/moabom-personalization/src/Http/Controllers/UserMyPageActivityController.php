<?php

namespace Modules\Moabom\Personalization\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Modules\Moabom\Personalization\Services\UserMyPageActivityService;

/**
 * 마이페이지 게시글 관리 (sirsoft-board 연동).
 *
 * 사용자가 마이페이지 "게시글 관리" 화면에서 자신이 쓴 글·댓글, 그리고 자신에게
 * 도착한 상호작용(받은 댓글/답글)을 한 피드로 조회한다.
 *
 * 데이터 접근·변환은 {@see UserMyPageActivityService} (→ Repository)로 위임하고,
 * 본 컨트롤러는 쿼리 파라미터 정규화와 응답/오류 처리만 담당한다.
 */
class UserMyPageActivityController extends AuthBaseController
{
    private const VALID_TYPES = ['all', 'posts', 'comments', 'interactions'];

    private const DEFAULT_LIMIT = 10;

    private const MIN_LIMIT = 1;

    private const MAX_LIMIT = 50;

    private const MAX_OFFSET = 5000;

    public function __construct(
        private readonly UserMyPageActivityService $activityService,
    ) {
        parent::__construct();
    }

    /**
     * 현재 사용자의 게시판 활동과 상호작용을 조회합니다.
     */
    public function index(Request $request): JsonResponse
    {
        $user = null;

        try {
            $user = $this->getCurrentUser();

            // Sanctum 인증 후에도 토큰 무효·세션 경계 등으로 사용자가 비는 경우를 방어한다.
            if (! $user) {
                return ResponseHelper::unauthorized('auth.unauthenticated');
            }

            $type = (string) $request->query('type', 'all');
            if (! in_array($type, self::VALID_TYPES, true)) {
                $type = 'all';
            }

            $limit = (int) $request->query('limit', self::DEFAULT_LIMIT);
            $limit = min(max($limit, self::MIN_LIMIT), self::MAX_LIMIT);

            $offset = (int) $request->query('offset', 0);
            $offset = min(max($offset, 0), self::MAX_OFFSET);

            return ResponseHelper::moduleSuccess(
                'moabom-personalization',
                'messages.mypage_activity.fetch_success',
                $this->activityService->buildPayload($user->id, $type, $limit, $offset)
            );
        } catch (\Throwable $e) {
            // 외부에 원본 예외 메시지를 노출하지 않고, 운영 로그에만 남긴다.
            Log::error('[moabom-personalization] user activities fetch failed', [
                'user_id' => $user->id ?? null,
                'exception' => $e::class,
                'message' => $e->getMessage(),
            ]);

            return ResponseHelper::moduleError(
                'moabom-personalization',
                'messages.mypage_activity.fetch_failed',
                500
            );
        }
    }
}
