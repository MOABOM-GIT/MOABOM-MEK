<?php

namespace Modules\Moabom\Apps\Services;

use Illuminate\Support\Facades\Crypt;
use Modules\Moabom\Apps\Contracts\GeneratedAppRepositoryInterface;
use Modules\Moabom\Apps\Enums\AppTier;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Support\GeneratedAppDataScope;
use Modules\Moabom\Apps\Support\GeneratedAppHostParser;
use Modules\Moabom\Apps\Support\GeneratedAppPreviewRouting;
use Modules\Moabom\Apps\Support\GeneratedAppPublishPolicy;
use Modules\Moabom\System\Saas\TenantRequestHost;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Standard/Hosted 프리뷰 URL·접근 토큰·HTML 서빙.
 *
 * SSOT: dedicated_host — apps.mek360.com / {id}.apps.mek360.com
 */
class GeneratedAppPreviewService
{
    private const LEGACY_HOSTED_SUBDOMAIN_PATTERN = '/^app(\d+)$/';

    public function __construct(
        private readonly GeneratedAppRepositoryInterface $appRepository,
        private readonly GeneratedAppHtmlService $htmlService,
        private readonly GeneratedAppHostParser $hostParser,
    ) {
    }

    public function findStandardApp(int $id): ?GeneratedApp
    {
        $app = $this->appRepository->findById($id);
        if ($app === null || $this->tierOf($app) === AppTier::Hosted) {
            return null;
        }

        return $app;
    }

    public function findHostedApp(int $id): ?GeneratedApp
    {
        $app = $this->appRepository->findById($id);
        if ($app === null || $this->tierOf($app) !== AppTier::Hosted) {
            return null;
        }

        return $app;
    }

    public function findHostedAppByHost(string $host): ?GeneratedApp
    {
        $parsed = $this->hostParser->parse($host);
        if ($parsed['type'] === 'hosted' && $parsed['app_id'] !== null) {
            return $this->findHostedApp($parsed['app_id']);
        }

        $subdomain = $this->parseLegacyHostedSubdomain($host);
        if ($subdomain === null) {
            return null;
        }

        return $this->findHostedAppByLegacySubdomain($subdomain);
    }

    public function findHostedAppByLegacySubdomain(string $subdomain): ?GeneratedApp
    {
        if (ctype_digit($subdomain)) {
            return $this->findHostedApp((int) $subdomain);
        }

        if (! preg_match(self::LEGACY_HOSTED_SUBDOMAIN_PATTERN, $subdomain, $matches)) {
            return null;
        }

        $app = $this->findHostedApp((int) $matches[1]);
        if ($app === null) {
            return null;
        }

        if ($app->hosted_subdomain !== null && $app->hosted_subdomain !== $subdomain) {
            return null;
        }

        return $app;
    }

    public function buildPreviewUrl(GeneratedApp $app, ?int $viewerUserId = null): string
    {
        if (GeneratedAppPreviewRouting::usesTenantPath()) {
            $path = $this->tierOf($app) === AppTier::Hosted
                ? GeneratedAppPreviewRouting::hostedPath($app->id)
                : GeneratedAppPreviewRouting::standardPath($app->id);
            $url = GeneratedAppPreviewRouting::tenantOrigin().$path;
        } else {
            $url = $this->dedicatedHostPreviewUrl($app);
        }

        if ($this->shouldAttachPreviewToken($viewerUserId)) {
            $token = $this->issueAccessToken($app, (int) $viewerUserId);
            $url .= (str_contains($url, '?') ? '&' : '?').'preview_token='.rawurlencode($token);
        }

        return $url;
    }

    public function issueAccessToken(GeneratedApp $app, int $viewerUserId): string
    {
        $ttl = max(300, (int) config('moabom-apps.preview.access_token_ttl_seconds', 7200));

        return Crypt::encryptString(json_encode([
            'app_id' => $app->id,
            'user_id' => $viewerUserId,
            'tenant_scope' => GeneratedAppPreviewRouting::tenantScopeKey(),
            'exp' => now()->addSeconds($ttl)->timestamp,
        ], JSON_THROW_ON_ERROR));
    }

    public function canAccessPreviewHtml(GeneratedApp $app, ?string $previewToken): bool
    {
        if (GeneratedAppPublishPolicy::viewerCanSeePublished($app)) {
            return true;
        }

        if (GeneratedAppPublishPolicy::viewerCanSeePublishedHtmlOnDedicatedHost($app)) {
            return true;
        }

        return $this->resolveDataScope($app, $previewToken) !== null;
    }

    public function canAccessHostedDataRead(GeneratedApp $app, ?string $previewToken): bool
    {
        return $this->resolveDataScope($app, $previewToken) !== null;
    }

    public function canAccessHostedDataWrite(GeneratedApp $app, ?string $previewToken): bool
    {
        return $this->resolveDataScope($app, $previewToken) !== null;
    }

    public function assertCanAccessPreviewHtml(GeneratedApp $app, ?string $previewToken): void
    {
        if (! $this->canAccessPreviewHtml($app, $previewToken)) {
            throw new NotFoundHttpException;
        }
    }

    public function assertCanAccessHostedDataRead(GeneratedApp $app, ?string $previewToken): void
    {
        if (! $this->canAccessHostedDataRead($app, $previewToken)) {
            throw new NotFoundHttpException;
        }
    }

    public function assertCanAccessHostedDataWrite(GeneratedApp $app, ?string $previewToken): void
    {
        if (! $this->canAccessHostedDataWrite($app, $previewToken)) {
            throw new NotFoundHttpException;
        }
    }

    public function resolveDataScope(GeneratedApp $app, ?string $previewToken): ?GeneratedAppDataScope
    {
        if ($previewToken === null || $previewToken === '') {
            return null;
        }

        try {
            $payload = json_decode(Crypt::decryptString($previewToken), true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            return null;
        }

        if (! is_array($payload)) {
            return null;
        }

        return GeneratedAppDataScope::fromAccessPayload($app, $payload);
    }

    /**
     * @return array<string, string>
     */
    public function previewResponseHeaders(): array
    {
        $ancestors = ["'self'"];

        $requestHost = TenantRequestHost::resolve();
        if ($requestHost !== '') {
            $scheme = request()->getScheme() ?: (string) config('moabom-apps.preview.scheme', 'https');
            $ancestors[] = $scheme.'://'.$requestHost;
        }

        foreach (GeneratedAppPreviewRouting::shellFrameAncestors() as $configured) {
            if (! in_array($configured, $ancestors, true)) {
                $ancestors[] = $configured;
            }
        }

        if (count($ancestors) === 1) {
            $ancestors[] = "'none'";
        }

        return [
            'Content-Security-Policy' => 'frame-ancestors '.implode(' ', $ancestors),
        ];
    }

    public function previewHtml(GeneratedApp $app, ?string $previewToken): string
    {
        return $this->htmlService->harden(
            (string) $app->html,
            $this->resolveDataScope($app, $previewToken),
        );
    }

    private function dedicatedHostPreviewUrl(GeneratedApp $app): string
    {
        $scheme = (string) config('moabom-apps.preview.scheme', 'https');

        if ($this->tierOf($app) === AppTier::Hosted) {
            return GeneratedAppPreviewRouting::hostedOriginForApp($app->id).'/';
        }

        $host = GeneratedAppPreviewRouting::standardHost();

        return $scheme.'://'.$host.'/g/'.$app->id;
    }

    private function parseLegacyHostedSubdomain(string $host): ?string
    {
        $baseDomain = (string) config('moabom-apps.preview.hosted_base_domain', 'mek360.com');
        $suffix = '.'.$baseDomain;
        if (! str_ends_with($host, $suffix)) {
            return null;
        }

        $subdomain = substr($host, 0, -strlen($suffix));
        if ($subdomain === '' || str_contains($subdomain, '.')) {
            return null;
        }

        return preg_match(self::LEGACY_HOSTED_SUBDOMAIN_PATTERN, $subdomain) === 1 ? $subdomain : null;
    }

    private function shouldAttachPreviewToken(?int $viewerUserId): bool
    {
        return $viewerUserId !== null;
    }

    private function tierOf(GeneratedApp $app): AppTier
    {
        return AppTier::tryFrom((string) ($app->tier ?? AppTier::Standard->value)) ?? AppTier::Standard;
    }
}
