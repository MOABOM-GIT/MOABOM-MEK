<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Models;

use Illuminate\Database\Eloquent\Model;

class ShellRankSnapshot extends Model
{
    protected $table = 'moabom_shell_rank_snapshots';

    protected $fillable = [
        'scope',
        'bucket_hour',
        'ranks',
    ];

    protected function casts(): array
    {
        return [
            'bucket_hour' => 'datetime',
            'ranks' => 'array',
        ];
    }
}
