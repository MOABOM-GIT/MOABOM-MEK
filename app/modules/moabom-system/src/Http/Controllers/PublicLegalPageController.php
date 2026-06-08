<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\Controllers;

use App\Http\Controllers\Api\Base\PublicBaseController;
use Illuminate\Http\JsonResponse;
use Modules\Moabom\System\Saas\TenantLegalPageReader;

/**
 * 테넌트 푸터 약관 페이지 — tenant DB + platform fallback.
 */
final class PublicLegalPageController extends PublicBaseController
{
    public function __construct(
        private readonly TenantLegalPageReader $legalPageReader,
    ) {
        parent::__construct();
    }

    public function __invoke(string $slug): JsonResponse
    {
        if (! $this->legalPageReader->isLegalSlug($slug)) {
            return $this->notFound('Page not found');
        }

        $payload = $this->legalPageReader->publishedPayload($slug);
        if ($payload === null) {
            return $this->notFound('sirsoft-page::messages.page.not_found');
        }

        return $this->success('Page fetched', $payload);
    }
}
