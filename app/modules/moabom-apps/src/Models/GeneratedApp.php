<?php

namespace Modules\Moabom\Apps\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * 사용자가 생성한 AI 앱 레코드.
 *
 * 테이블명 `moabom_system_generated_apps` 는 분리 이전(moabom-system) 명칭을 그대로
 * 유지한다(F1 호환). 데이터 보존이 목적이며, 마이그레이션은 `Schema::hasTable`
 * 가드로 idempotent 하게 작성된다.
 */
class GeneratedApp extends Model
{
    protected $table = 'moabom_system_generated_apps';

    /**
     * 대량 할당 가능한 속성입니다.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'user_id',
        'title',
        'app_type',
        'model_id',
        'prompt',
        'html',
        'is_shared',
        'parent_app_id',
        'version',
        'metadata',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_shared' => 'boolean',
            'metadata' => 'array',
            'version' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function parentApp(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_app_id');
    }
}
