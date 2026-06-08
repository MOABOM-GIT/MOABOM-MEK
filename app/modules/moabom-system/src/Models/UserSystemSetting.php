<?php

namespace Modules\Moabom\System\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserSystemSetting extends Model
{
    protected $table = 'moabom_system_user_settings';

    /**
     * 대량 할당 가능한 속성입니다.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'user_id',
        'settings',
    ];

    /**
     * 속성 캐스팅입니다.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'settings' => 'array',
        ];
    }

    /**
     * 설정 소유 사용자입니다.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
