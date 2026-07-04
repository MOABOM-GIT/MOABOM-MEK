<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use App\Extension\Traits\ValidatesLayoutFiles;

/**
 * 레이아웃 JSON을 DB 저장·서빙용 형태로 정규화합니다.
 *
 * G7 계약: filesystem(작성 SSOT, partial 참조 허용) → resolveAllPartials → DB(병합 완료본).
 * ModuleManager::validateLayoutFiles 와 동일한 partial 해석 파이프라인을 reconciler 에서도 재사용합니다.
 */
final class LayoutPersistenceNormalizer
{
    use ValidatesLayoutFiles;

    /**
     * @param  array<string, mixed>  $layoutData
     * @return array<string, mixed>
     */
    public function normalize(array $layoutData, string $layoutFilePath): array
    {
        $this->partialStack = [];

        return $this->resolveAllPartials(
            $layoutData,
            dirname($layoutFilePath),
            0,
            $layoutData['data_sources'] ?? [],
        );
    }
}
