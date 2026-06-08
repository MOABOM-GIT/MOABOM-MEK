<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Module 카테고리 페이로드 (DB-backed).
 *
 * tenant-scoped: tenant 요청은 hospital_{slug} DB, platform 요청은 platform DB 의 같은 테이블.
 * connection 은 런타임 컨텍스트 (TenantDatabaseConfigurator) 가 결정한 default 사용.
 *
 * @see deploy/AGENT-FAILURE-ANALYSIS.md §9 — GCS JSON 단점(read-after-write race, multi-instance staleness)
 */
final class ModuleSetting extends Model
{
    protected $table = 'moabom_module_settings';

    protected $fillable = [
        'module',
        'category',
        'payload',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
        ];
    }
}
