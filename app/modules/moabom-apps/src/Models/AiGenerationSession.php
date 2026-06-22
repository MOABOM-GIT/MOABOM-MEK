<?php

namespace Modules\Moabom\Apps\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * AI 생성 세션 — tenant DB 전용.
 *
 * `generated_app_id` 는 moabom-platform 의 앱 ID (논리 참조, DB FK 없음).
 *
 * @see docs/GENERATED-APP-TIERS.md §4 · §12
 */
class AiGenerationSession extends Model
{
    protected $table = 'moabom_ai_generation_sessions';

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'user_id',
        'status',
        'app_type',
        'model_id',
        'messages',
        'partial_raw',
        'generated_app_id',
        'finish_reason',
        'truncated',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'messages' => 'array',
            'truncated' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function generatedApp(): BelongsTo
    {
        return $this->belongsTo(GeneratedApp::class, 'generated_app_id');
    }
}
