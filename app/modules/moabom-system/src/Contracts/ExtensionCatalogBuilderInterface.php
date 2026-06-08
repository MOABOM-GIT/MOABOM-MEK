<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Contracts;

use App\Models\User;

/**
 * 현재 사용자 기준으로 노출 가능한 확장(모듈) 식별자 목록을 계산합니다.
 *
 * 향후 boot-payload Aggregator 가 동일 인터페이스를 주입받아 필터링에 사용합니다.
 */
interface ExtensionCatalogBuilderInterface
{
    /**
     * @return array<int, string> vendor-module 형식 식별자 목록(중복 없음, 정렬 없음)
     */
    public function getVisibleModuleIdentifiers(?User $user): array;
}
