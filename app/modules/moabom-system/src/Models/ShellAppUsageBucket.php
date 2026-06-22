<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Models;

use Illuminate\Database\Eloquent\Model;

class ShellAppUsageBucket extends Model
{
    protected $table = 'moabom_shell_app_usage_buckets';

    protected $fillable = [
        'bucket_hour',
        'app_id',
        'open_hits',
        'active_seconds',
    ];

    protected function casts(): array
    {
        return [
            'bucket_hour' => 'datetime',
            'open_hits' => 'integer',
            'active_seconds' => 'integer',
        ];
    }
}
