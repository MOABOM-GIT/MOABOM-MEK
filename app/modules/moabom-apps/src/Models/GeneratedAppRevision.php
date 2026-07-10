<?php

namespace Modules\Moabom\Apps\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * 생성앱 HTML 스냅샷(타임머신).
 */
class GeneratedAppRevision extends Model
{
    protected $table = 'moabom_generated_app_revisions';

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'generated_app_id',
        'revision_number',
        'source',
        'html_hash',
        'html',
        'title',
        'created_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'revision_number' => 'integer',
            'created_by' => 'integer',
        ];
    }

    public function generatedApp(): BelongsTo
    {
        return $this->belongsTo(GeneratedApp::class, 'generated_app_id');
    }
}
