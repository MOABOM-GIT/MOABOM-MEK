<?php

namespace Modules\Moabom\Cpap\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CpapMeasurement extends Model
{
    /**
     * F1 호환: Phase 4 분리 후에도 테이블명을 보존한다.
     */
    protected $table = 'moabom_system_cpap_measurements';

    /**
     * 대량 할당 가능한 속성입니다.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'user_id',
        'profile',
        'measurements',
        'profile_measurements',
        'recommendation',
        'mask_type',
        'confidence',
        'metadata',
    ];

    /**
     * 속성 캐스팅입니다.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'profile' => 'array',
            'measurements' => 'array',
            'profile_measurements' => 'array',
            'recommendation' => 'array',
            'confidence' => 'float',
            'metadata' => 'array',
        ];
    }

    /**
     * 측정 소유 사용자입니다.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
