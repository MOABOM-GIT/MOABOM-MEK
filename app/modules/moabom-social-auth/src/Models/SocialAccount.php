<?php

namespace Modules\Moabom\Social\Auth\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SocialAccount extends Model
{
    /**
     * 대량 할당 가능한 속성
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'user_id',
        'provider',
        'provider_user_id',
        'email',
        'name',
        'nickname',
        'avatar',
        'access_token',
        'refresh_token',
        'token_expires_at',
        'linked_at',
    ];

    /**
     * 속성 캐스팅
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'access_token' => 'encrypted',
            'refresh_token' => 'encrypted',
            'token_expires_at' => 'datetime',
            'linked_at' => 'datetime',
        ];
    }

    /**
     * 연결된 사용자입니다.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
