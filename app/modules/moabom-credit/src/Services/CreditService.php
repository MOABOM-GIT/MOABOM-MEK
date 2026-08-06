<?php

namespace Modules\Moabom\Credit\Services;

use App\Extension\HookManager;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Modules\Moabom\Credit\Contracts\CreditRepositoryInterface;
use Modules\Moabom\Credit\Enums\CreditRewardSourceType;
use Modules\Moabom\Credit\Enums\CreditTransactionType;
use Modules\Moabom\Credit\Models\CreditAttendance;
use Modules\Moabom\Credit\Models\CreditTransaction;

class CreditService
{
    public function __construct(
        private CreditRepositoryInterface $creditRepository,
        private CreditSettingsService $settingsService,
        private CreditLevelService $levelService,
    ) {}

    /**
     * 마이페이지 크레딧 정보를 조회합니다.
     *
     * @return array<string, mixed>
     */
    public function getUserCreditOverview(User $user, int $limit = 8, int $offset = 0): array
    {
        $balance = $this->creditRepository->getOrCreateBalance($user);
        $rankingPoints = (int) ($balance->ranking_points ?? 0);
        $level = $this->levelService->resolve($rankingPoints);

        // limit=0: 셸 프로필·레벨 전용 — 원장 SUM/COUNT/목록을 건너뛰어 upstream timeout 완화.
        $safeLimit = max(0, min(50, $limit));
        $safeOffset = max(0, $offset);
        if ($safeLimit === 0) {
            return HookManager::applyFilters('moabom-credit.filter_overview', [
                'balance' => $balance->balance,
                'ranking_points' => $rankingPoints,
                'level' => $level,
                'summary' => [
                    'total_earned' => 0,
                    'total_used' => 0,
                    'transaction_count' => 0,
                ],
                'transactions' => [],
                'pagination' => [
                    'limit' => 0,
                    'offset' => 0,
                    'total' => 0,
                    'has_more' => false,
                ],
            ], $user);
        }

        $summary = $this->creditRepository->getSummary($user);
        $transactionTotal = $this->creditRepository->getTransactionCount($user);
        $attendance = $this->attendanceStatusForUser($user);
        $transactions = $this->creditRepository->getRecentTransactions($user, $safeLimit, $safeOffset)
            ->map(fn (CreditTransaction $transaction) => $this->formatTransaction($transaction))
            ->values()
            ->all();

        return HookManager::applyFilters('moabom-credit.filter_overview', [
            'balance' => $balance->balance,
            'ranking_points' => $rankingPoints,
            'level' => $level,
            'attendance' => $attendance,
            'summary' => [
                ...$summary,
                'transaction_count' => $transactionTotal,
            ],
            'transactions' => $transactions,
            'pagination' => [
                'limit' => $safeLimit,
                'offset' => $safeOffset,
                'total' => $transactionTotal,
                'has_more' => ($safeOffset + count($transactions)) < $transactionTotal,
            ],
        ], $user);
    }

    /**
     * 오늘 출석 여부와 다음 출석 가능 시각을 반환합니다.
     *
     * @return array{checked_today: bool, attendance_date: string, next_available_at: string}
     */
    private function attendanceStatusForUser(User $user): array
    {
        $now = CarbonImmutable::now();
        $today = $now->toDateString();

        return [
            'checked_today' => CreditAttendance::where('user_id', $user->id)
                ->whereDate('attendance_date', $today)
                ->exists(),
            'attendance_date' => $today,
            'next_available_at' => $now->addDay()->startOfDay()->toISOString(),
        ];
    }

    /**
     * 크레딧 거래를 원장에 기록하고 잔액을 갱신합니다.
     *
     * @param  array<string, mixed>|null  $meta
     */
    public function recordTransaction(
        User $user,
        CreditTransactionType $type,
        int $amount,
        ?string $description = null,
        ?string $sourceType = null,
        ?string $sourceId = null,
        ?array $meta = null,
        bool $skipDailyEarnLimit = false,
    ): CreditTransaction {
        if ($amount === 0) {
            throw new InvalidArgumentException(__('moabom-credit::messages.invalid_amount'));
        }

        return DB::transaction(function () use ($user, $type, $amount, $description, $sourceType, $sourceId, $meta, $skipDailyEarnLimit) {
            $balance = $this->creditRepository->getOrCreateBalanceForUpdate($user);
            $signedAmount = $this->normalizeAmount($type, $amount);
            $nextBalance = $balance->balance + $signedAmount;

            if ($nextBalance < 0) {
                throw new InvalidArgumentException(__('moabom-credit::messages.insufficient_balance'));
            }

            if ($signedAmount > 0 && ! $skipDailyEarnLimit) {
                $this->ensureDailyEarnLimit($user, $signedAmount);
            }

            HookManager::doAction('moabom-credit.before_record', $user, $type, $signedAmount);

            $this->creditRepository->updateBalance($balance, $nextBalance);
            if (
                $type === CreditTransactionType::Earn
                && $signedAmount > 0
                && is_string($sourceType)
                && in_array($sourceType, CreditRewardSourceType::rankingValues(), true)
            ) {
                $this->creditRepository->incrementRankingPoints($balance, $signedAmount);
            }
            $transaction = $this->creditRepository->createTransaction([
                'user_id' => $user->id,
                'type' => $type,
                'amount' => $signedAmount,
                'balance_after' => $nextBalance,
                'description' => $description,
                'source_type' => $sourceType,
                'source_id' => $sourceId,
                'meta' => $meta,
            ]);

            HookManager::doAction('moabom-credit.after_record', $transaction, $user);

            return $transaction;
        });
    }

    /**
     * 출석체크 크레딧을 적립합니다.
     *
     * @return array<string, mixed>
     */
    public function checkAttendance(User $user, bool $adWatched = false): array
    {
        $settings = $this->settingsService->getAllSettings();
        if (! (bool) ($settings['rewards']['attendance_enabled'] ?? true)) {
            throw new InvalidArgumentException(__('moabom-credit::messages.attendance.disabled'));
        }

        $requiresAd = (bool) ($settings['ads']['attendance_requires_ad'] ?? false);
        if ($requiresAd && ! $adWatched) {
            throw new InvalidArgumentException(__('moabom-credit::messages.attendance.ad_required'));
        }

        $today = CarbonImmutable::now()->toDateString();
        if (CreditAttendance::where('user_id', $user->id)->whereDate('attendance_date', $today)->exists()) {
            throw new InvalidArgumentException(__('moabom-credit::messages.attendance.already_checked'));
        }

        $baseAmount = (int) ($settings['rewards']['attendance_amount'] ?? 10);
        $multiplier = $requiresAd ? (float) ($settings['ads']['attendance_ad_reward_multiplier'] ?? 1) : 1.0;
        $rewardAmount = max(0, (int) floor($baseAmount * $multiplier));

        return DB::transaction(function () use ($user, $today, $rewardAmount, $adWatched) {
            $attendance = CreditAttendance::create([
                'user_id' => $user->id,
                'attendance_date' => $today,
                'reward_amount' => $rewardAmount,
                'ad_watched' => $adWatched,
                'meta' => [
                    'source' => 'mypage',
                ],
            ]);

            $transaction = $this->recordTransaction(
                $user,
                CreditTransactionType::Earn,
                $rewardAmount,
                __('moabom-credit::messages.attendance.transaction_description'),
                'attendance',
                $today,
                [
                    'attendance_id' => $attendance->id,
                    'ad_watched' => $adWatched,
                ]
            );

            return [
                'attendance' => [
                    'id' => $attendance->id,
                    'attendance_date' => $today,
                    'reward_amount' => $rewardAmount,
                    'ad_watched' => $adWatched,
                ],
                'transaction' => $this->formatTransaction($transaction),
                'overview' => $this->getUserCreditOverview($user),
            ];
        });
    }

    /**
     * API 응답용 거래 내역으로 변환합니다.
     *
     * @return array<string, mixed>
     */
    private function formatTransaction(CreditTransaction $transaction): array
    {
        return [
            'id' => $transaction->id,
            'type' => $transaction->type?->value,
            'type_label' => $transaction->type?->label(),
            'amount' => $transaction->amount,
            'balance_after' => $transaction->balance_after,
            'description' => $transaction->description,
            'source_type' => $transaction->source_type,
            'source_id' => $transaction->source_id,
            'created_at' => $transaction->created_at?->toISOString(),
            'created_at_human' => $transaction->created_at?->diffForHumans(),
        ];
    }

    /**
     * 거래 유형에 맞는 증감액으로 정규화합니다.
     */
    private function normalizeAmount(CreditTransactionType $type, int $amount): int
    {
        return match ($type) {
            CreditTransactionType::Earn => abs($amount),
            CreditTransactionType::Spend, CreditTransactionType::Expire => -abs($amount),
            CreditTransactionType::Adjust => $amount,
        };
    }

    /**
     * 사용자별 일일 총 적립 한도를 확인합니다.
     */
    private function ensureDailyEarnLimit(User $user, int $amount): void
    {
        $dailyLimit = (int) $this->settingsService->getSetting('limits.daily_earn_limit', 0);
        if ($dailyLimit <= 0) {
            return;
        }

        $todayEarned = (int) CreditTransaction::where('user_id', $user->id)
            ->where('amount', '>', 0)
            ->whereDate('created_at', CarbonImmutable::now()->toDateString())
            ->sum('amount');

        if (($todayEarned + $amount) > $dailyLimit) {
            throw new InvalidArgumentException(__('moabom-credit::messages.daily_limit_exceeded'));
        }
    }
}
