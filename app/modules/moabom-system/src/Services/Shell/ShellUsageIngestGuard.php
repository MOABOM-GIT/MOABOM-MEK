<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Services\Shell;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Modules\Moabom\System\Support\MoabomPublicApiCacheKeys;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

final class ShellUsageIngestGuard
{
    /**
     * @return array{usage_ingest_token: string, usage_bucket_hour: string}
     */
    public function bootPayload(): array
    {
        $hour = now()->utc()->startOfHour();

        return [
            'usage_ingest_token' => $this->issueTokenForHour($hour),
            'usage_bucket_hour' => $hour->toIso8601String(),
        ];
    }

    public function issueTokenForHour(\DateTimeInterface $hour): string
    {
        $payload = $this->signingPayload($hour);

        return hash_hmac('sha256', $payload, $this->signingKey());
    }

    public function isValidToken(?string $token): bool
    {
        if ($token === null || $token === '') {
            return false;
        }

        $current = now()->utc()->startOfHour();
        $candidates = [
            $this->issueTokenForHour($current),
            $this->issueTokenForHour($current->copy()->subHour()),
        ];

        foreach ($candidates as $candidate) {
            if (hash_equals($candidate, $token)) {
                return true;
            }
        }

        return false;
    }

    public function enforce(Request $request): void
    {
        $token = $request->header('X-Moabom-Shell-Usage-Token');
        $hasValidToken = $this->isValidToken(is_string($token) ? $token : null);

        if (filter_var(config('moabom-system.shell_rankings.ingest.signed_token_required', false), FILTER_VALIDATE_BOOL)
            && ! $hasValidToken) {
            throw new TooManyRequestsHttpException(60, 'shell_usage_token_required');
        }

        $limit = $hasValidToken
            ? max(1, (int) config('moabom-system.shell_rankings.ingest.max_requests_per_ip_per_minute', 60))
            : max(1, (int) config('moabom-system.shell_rankings.ingest.max_requests_per_ip_per_minute_without_token', 12));

        $ip = trim((string) $request->ip());
        if ($ip === '') {
            $ip = 'unknown';
        }

        $rateKey = sprintf(
            'moabom.shell.usage.rate:%s:%s',
            MoabomPublicApiCacheKeys::tenantScopeToken(),
            hash('sha256', $ip),
        );

        $count = (int) Cache::get($rateKey, 0) + 1;
        Cache::put($rateKey, $count, 60);

        if ($count > $limit) {
            throw new TooManyRequestsHttpException(60, 'shell_usage_rate_limited');
        }
    }

    private function signingPayload(\DateTimeInterface $hour): string
    {
        $normalized = $hour instanceof \Carbon\CarbonInterface
            ? $hour->copy()->utc()->startOfHour()->format('Y-m-d H')
            : (new \DateTimeImmutable($hour->format('Y-m-d H:i:s'), new \DateTimeZone('UTC')))
                ->format('Y-m-d H');

        return MoabomPublicApiCacheKeys::tenantScopeToken().'|'.$normalized;
    }

    private function signingKey(): string
    {
        return (string) config('app.key');
    }
}
