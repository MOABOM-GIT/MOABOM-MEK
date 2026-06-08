<?php

namespace Modules\Moabom\System\Http\Controllers;

use App\Helpers\ResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Modules\Moabom\System\Experience\TenantExperienceDefaultsReader;
use Modules\Moabom\System\Support\MoabomPublicApiCache;
use Modules\Moabom\System\Support\MoabomPublicApiCacheKeys;
use Modules\Moabom\System\Support\MoabomUiLocales;

/**
 * 비로그인 셸·게스트 마이페이지가 플랫폼 기본값(menus·appearance·preferences 노출분)을
 * 받을 수 있도록 합니다. PII 없음(`getFrontendSettings` 스키마만).
 */
class PublicFrontendDefaultsController extends Controller
{
    public function __invoke(TenantExperienceDefaultsReader $defaultsReader): JsonResponse
    {
        $revision = $defaultsReader->combinedRevision();

        return MoabomPublicApiCache::remember(
            MoabomPublicApiCacheKeys::frontendDefaults($revision),
            fn (): JsonResponse => ResponseHelper::moduleSuccess(
                'moabom-system',
                'messages.public_defaults.fetch_success',
                [
                    'defaults' => $defaultsReader->frontendDefaults(),
                    'defaults_revision' => $revision,
                    'site' => $defaultsReader->siteMeta(),
                    'locale_catalog' => MoabomUiLocales::catalog(),
                ]
            ),
        );
    }
}
