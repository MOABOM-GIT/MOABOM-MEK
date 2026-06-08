<?php

namespace Modules\Moabom\Consulting\Enums;

/**
 * 전자계약 상태 Enum
 */
enum ContractStatus: string
{
    /** 미서명 임시 저장 */
    case Draft = 'draft';

    /** 서명 완료 */
    case Signed = 'signed';

    /**
     * 서명 여부로부터 계약 상태를 결정합니다.
     */
    public static function fromSigned(bool $signed): self
    {
        return $signed ? self::Signed : self::Draft;
    }

    /**
     * 계약 상태 라벨을 반환합니다.
     */
    public function label(): string
    {
        return match ($this) {
            self::Draft => __('moabom-consulting::messages.consulting.status_draft'),
            self::Signed => __('moabom-consulting::messages.consulting.status_signed'),
        };
    }
}
