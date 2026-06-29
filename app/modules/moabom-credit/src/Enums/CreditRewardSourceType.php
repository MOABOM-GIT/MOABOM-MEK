<?php

namespace Modules\Moabom\Credit\Enums;

/**
 * 크레딧 적립 이벤트 출처 — 활동 순위 집계 SSOT.
 */
enum CreditRewardSourceType: string
{
    case Login = 'login';
    case PostWrite = 'post_write';
    case LikeReceived = 'like_received';
    case Attendance = 'attendance';
    case CommentWrite = 'comment_write';
    case AppReviewWrite = 'app_review_write';

    /**
     * @return list<string>
     */
    public static function rankingValues(): array
    {
        return array_map(
            static fn (self $case): string => $case->value,
            self::cases(),
        );
    }
}
