<?php

namespace Modules\Moabom\Social\Auth\Models;

use Illuminate\Database\Eloquent\Model;

class SocialAuthSetting extends Model
{
    protected $fillable = [
        'provider',
        'enabled',
        'use_master_defaults',
        'client_id',
        'client_secret',
        'redirect_uri',
        'google_request_auth_time',
        'kakao_use_client_secret',
        'extra_json',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'use_master_defaults' => 'boolean',
            'client_id' => 'encrypted',
            'client_secret' => 'encrypted',
            'google_request_auth_time' => 'boolean',
            'kakao_use_client_secret' => 'boolean',
            'extra_json' => 'array',
        ];
    }
}

