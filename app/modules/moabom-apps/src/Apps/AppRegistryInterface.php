<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Apps;

/**
 * 활성 모듈의 app.json 을 집계하는 앱 레지스트리 (Phase 4 — 앱 SDK 토대).
 */
interface AppRegistryInterface
{
    /**
     * 활성 모듈의 모든 앱 매니페스트(정렬됨).
     *
     * @return list<AppManifest>
     */
    public function all(): array;

    /**
     * 특정 템플릿(셸)용 앱 매니페스트 페이로드. frontend.template 이 일치하거나
     * 미지정(백엔드 전용)인 항목만 포함한다.
     *
     * @return list<array<string, mixed>>
     */
    public function forShell(string $template): array;
}
