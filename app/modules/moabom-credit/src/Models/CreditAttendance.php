<?php

namespace Modules\Moabom\Credit\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * 사용자 크레딧 출석체크 모델
 */
class CreditAttendance extends Model
{
    protected $table = 'moabom_credit_attendances';

    protected $fillable = [
        'user_id',
        'attendance_date',
        'reward_amount',
        'ad_watched',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'attendance_date' => 'date',
            'reward_amount' => 'integer',
            'ad_watched' => 'boolean',
            'meta' => 'array',
        ];
    }

    /**
     * 출석체크의 사용자 관계를 정의합니다.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
