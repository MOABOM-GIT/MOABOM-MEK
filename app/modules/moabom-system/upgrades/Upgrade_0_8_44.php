<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Upgrades;

use App\Contracts\Extension\UpgradeStepInterface;
use App\Extension\UpgradeContext;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 알림 보관기간·사용자당 500건 순환 정리용 인덱스를 보강합니다.
 */
final class Upgrade_0_8_44 implements UpgradeStepInterface
{
    public function run(UpgradeContext $context): void
    {
        if (! Schema::hasTable('notifications')) {
            return;
        }

        $indexes = collect(Schema::getIndexes('notifications'))
            ->pluck('name')
            ->filter()
            ->all();

        Schema::table('notifications', function (Blueprint $table) use ($indexes): void {
            if (! in_array('idx_notifications_notifiable_created_at', $indexes, true)) {
                $table->index(
                    ['notifiable_type', 'notifiable_id', 'created_at'],
                    'idx_notifications_notifiable_created_at',
                );
            }
            if (! in_array('idx_notifications_read_created_at', $indexes, true)) {
                $table->index(
                    ['read_at', 'created_at'],
                    'idx_notifications_read_created_at',
                );
            }
        });

        $context->logger->info('[moabom-system 0.8.44] 알림 보관정책 인덱스 보강 완료');
    }
}
