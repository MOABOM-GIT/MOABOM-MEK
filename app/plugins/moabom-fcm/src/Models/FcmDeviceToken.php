<?php

declare(strict_types=1);

namespace Plugins\Moabom\Fcm\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Plugins\Moabom\Fcm\Enums\FcmPlatform;

/**
 * @property int $id
 * @property int $user_id
 * @property int|null $tenant_id
 * @property string $token
 * @property string $platform
 * @property string|null $device_label
 * @property string|null $user_agent
 * @property \Illuminate\Support\Carbon|null $last_seen_at
 */
class FcmDeviceToken extends Model
{
    protected $table = 'moabom_fcm_device_tokens';

    protected $fillable = [
        'user_id',
        'tenant_id',
        'token',
        'platform',
        'device_label',
        'user_agent',
        'last_seen_at',
    ];

    protected function casts(): array
    {
        return [
            'last_seen_at' => 'datetime',
            'platform' => FcmPlatform::class,
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
