<?php

namespace Modules\Moabom\Credit\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * 사용자 크레딧 잔액 모델
 */
class CreditBalance extends Model
{
    protected $table = 'moabom_credit_balances';

    protected $fillable = [
        'user_id',
        'balance',
    ];

    protected function casts(): array
    {
        return [
            'balance' => 'integer',
        ];
    }

    /**
     * 잔액의 사용자 관계를 정의합니다.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
