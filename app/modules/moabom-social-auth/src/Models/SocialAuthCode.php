<?php

namespace Modules\Moabom\Social\Auth\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SocialAuthCode extends Model
{
    /**
     * 대량 할당 가능한 속성
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'user_id',
        'code_hash',
        'provider',
        'requires_profile_completion',
        'expires_at',
        'profile_completed_at',
        'used_at',
    ];

    /**
     * 속성 캐스팅
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'requires_profile_completion' => 'boolean',
            'expires_at' => 'datetime',
            'profile_completed_at' => 'datetime',
            'used_at' => 'datetime',
        ];
    }

    /**
     * 토큰을 발급할 사용자입니다.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
