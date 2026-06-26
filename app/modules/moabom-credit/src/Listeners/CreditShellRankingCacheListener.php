<?php

namespace Modules\Moabom\Credit\Listeners;

use App\Contracts\Extension\HookListenerInterface;
use Modules\Moabom\Credit\Enums\CreditRewardSourceType;
use Modules\Moabom\Credit\Enums\CreditTransactionType;
use Modules\Moabom\Credit\Models\CreditTransaction;
use Modules\Moabom\System\Support\MoabomPublicApiCacheKeys;

final class CreditShellRankingCacheListener implements HookListenerInterface
{
    public static function getSubscribedHooks(): array
    {
        return [
            'moabom-credit.after_record' => [
                'method' => 'onAfterRecord',
                'priority' => 20,
            ],
        ];
    }

    public function handle(...$args): void {}

    public function onAfterRecord(...$args): void
    {
        $transaction = $args[0] ?? null;
        if (! $transaction instanceof CreditTransaction) {
            return;
        }

        if ($transaction->type !== CreditTransactionType::Earn) {
            return;
        }

        $sourceType = (string) $transaction->source_type;
        if (! in_array($sourceType, CreditRewardSourceType::rankingValues(), true)) {
            return;
        }

        MoabomPublicApiCacheKeys::forgetShellRankings();
    }
}
