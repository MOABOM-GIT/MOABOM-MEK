<?php

namespace Modules\Moabom\Credit\Enums;

/**
 * 크레딧 거래 유형 Enum
 */
enum CreditTransactionType: string
{
    /** 크레딧 적립 */
    case Earn = 'earn';

    /** 크레딧 사용 */
    case Spend = 'spend';

    /** 관리자 또는 시스템 조정 */
    case Adjust = 'adjust';

    /** 크레딧 만료 */
    case Expire = 'expire';

    /**
     * 거래 유형 라벨을 반환합니다.
     */
    public function label(): string
    {
        return match ($this) {
            self::Earn => __('moabom-credit::messages.types.earn'),
            self::Spend => __('moabom-credit::messages.types.spend'),
            self::Adjust => __('moabom-credit::messages.types.adjust'),
            self::Expire => __('moabom-credit::messages.types.expire'),
        };
    }
}
