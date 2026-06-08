<?php

namespace Modules\Moabom\Consulting\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Moabom\Consulting\Enums\ContractStatus;

class Contract extends Model
{
    protected $table = 'moabom_consulting_contracts';

    /**
     * 대량 할당 가능한 속성입니다.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'user_id',
        'hospital_name',
        'representative_name',
        'contact',
        'business_number',
        'plan',
        'simulation_input',
        'simulation_result',
        'signer_name',
        'signature',
        'signed_at',
        'status',
        'memo',
    ];

    /**
     * 속성 캐스팅입니다.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'simulation_input' => 'array',
            'simulation_result' => 'array',
            'signed_at' => 'datetime',
            'status' => ContractStatus::class,
        ];
    }

    /**
     * 계약을 작성한 상담원입니다.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
