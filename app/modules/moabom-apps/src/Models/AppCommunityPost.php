<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Moabom\Apps\Enums\AppCommunityPostStatus;
use Modules\Moabom\Apps\Enums\AppCommunityPostType;

/**
 * 앱 이야기(리뷰) 글.
 */
class AppCommunityPost extends Model
{
    use SoftDeletes;

    protected $table = 'moabom_app_community_posts';

    /**
     * @var array<int, string>
     */
    protected $fillable = [
        'generated_app_id',
        'tenant_slug',
        'user_id',
        'post_type',
        'rating',
        'title',
        'body',
        'status',
        'hidden_reason',
        'comments_count',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'generated_app_id' => 'integer',
            'user_id' => 'integer',
            'rating' => 'integer',
            'comments_count' => 'integer',
            'post_type' => AppCommunityPostType::class,
            'status' => AppCommunityPostStatus::class,
        ];
    }

    public function generatedApp(): BelongsTo
    {
        $relation = $this->belongsTo(GeneratedApp::class, 'generated_app_id');
        $connection = $this->getConnectionName();
        if ($connection !== null) {
            $relation->getRelated()->setConnection($connection);
        }

        return $relation;
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
