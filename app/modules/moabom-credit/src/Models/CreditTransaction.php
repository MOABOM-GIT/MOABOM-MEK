<?php

namespace Modules\Moabom\Credit\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Moabom\Credit\Enums\CreditTransactionType;

/**
 * 사용자 크레딧 거래 원장 모델
 */
class CreditTransaction extends Model
{
    protected $table = 'moabom_credit_transactions';

    protected $fillable = [
        'user_id',
        'type',
        'amount',
        'balance_after',
        'description',
        'source_type',
        'source_id',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'type' => CreditTransactionType::class,
            'amount' => 'integer',
            'balance_after' => 'integer',
            'meta' => 'array',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    /**
     * 거래의 사용자 관계를 정의합니다.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
