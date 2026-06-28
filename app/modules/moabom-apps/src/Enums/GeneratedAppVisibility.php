<?php

namespace Modules\Moabom\Apps\Enums;

/**
 * AI 생성앱 공개 범위.
 *
 * - private: 소유자만
 * - tenant:  생성 업체(tenant_slug) 내 앱 등록
 * - global:  전체 테넌트 공개 (레거시 is_shared=true)
 */
enum GeneratedAppVisibility: string
{
    case Private = 'private';
    case Tenant = 'tenant';
    case Global = 'global';

    public function isPublished(): bool
    {
        return $this !== self::Private;
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $case): string => $case->value, self::cases());
    }
}
