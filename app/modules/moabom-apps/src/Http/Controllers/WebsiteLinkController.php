<?php

namespace Modules\Moabom\Apps\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use Illuminate\Http\JsonResponse;
use InvalidArgumentException;
use Modules\Moabom\Apps\Http\Requests\ResolveWebsiteLinkRequest;
use Modules\Moabom\Apps\Services\WebsiteLinkResolveService;

class WebsiteLinkController extends AuthBaseController
{
    public function __construct(
        private readonly WebsiteLinkResolveService $websiteLinkResolveService,
    ) {
        parent::__construct();
    }

    /**
     * 웹사이트 URL을 정규화하고 head 아이콘·포인트 컬러·타이틀 아이콘 여부를 반환합니다.
     */
    public function resolve(ResolveWebsiteLinkRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        try {
            $resolved = $this->websiteLinkResolveService->resolve((string) $request->validated('url'));
        } catch (InvalidArgumentException $exception) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.website_link.resolve_failed',
                422,
                ['message' => $exception->getMessage()],
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.website_link.resolve_success',
            $resolved,
        );
    }
}
