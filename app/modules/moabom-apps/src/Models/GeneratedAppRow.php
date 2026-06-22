<?php

namespace Modules\Moabom\Apps\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Hosted 생성 앱의 row 격리 데이터.
 */
class GeneratedAppRow extends Model
{
    protected $table = 'moabom_generated_app_rows';

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'generated_app_id',
        'tenant_slug',
        'user_id',
        'table_key',
        'payload',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'payload' => 'array',
        ];
    }

    public function generatedApp(): BelongsTo
    {
        return $this->belongsTo(GeneratedApp::class, 'generated_app_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
