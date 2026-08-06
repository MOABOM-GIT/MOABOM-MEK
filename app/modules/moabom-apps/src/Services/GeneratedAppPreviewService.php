<?php

namespace Modules\Moabom\Apps\Services;

use Illuminate\Support\Facades\Crypt;
use Modules\Moabom\Apps\Contracts\GeneratedAppRepositoryInterface;
use Modules\Moabom\Apps\Enums\AppTier;
use Modules\Moabom\Apps\Enums\AppType;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Support\GeneratedAppDataScope;
use Modules\Moabom\Apps\Support\GeneratedAppHostParser;
use Modules\Moabom\Apps\Support\GeneratedAppPreviewRouting;
use Modules\Moabom\Apps\Support\GeneratedAppPublishPolicy;
use Modules\Moabom\System\Saas\TenantRequestHost;
use Modules\Moabom\System\Support\MoabomPublicApiCache;
use Modules\Moabom\System\Support\MoabomPublicApiCacheKeys;
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
        private readonly WebsiteLinkUrlGuard $websiteLinkUrlGuard,
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
        // 웹사이트 연결은 /g/{id} placeholder 가 아니라 외부 URL이 실행 표면(셸과 동일 SSOT).
        if ((string) ($app->app_type ?? '') === AppType::WebsiteLink->value) {
            return $this->websiteLinkExternalUrl($app) ?? '';
        }

        if (GeneratedAppPreviewRouting::usesTenantPath()) {
            $path = $this->tierOf($app) === AppTier::Hosted
                ? GeneratedAppPreviewRouting::hostedPath($app->id)
                : GeneratedAppPreviewRouting::standardPath($app->id);
            $url = GeneratedAppPreviewRouting::tenantOrigin().$path;
        } else {
            $url = $this->dedicatedHostPreviewUrl($app);
        }

        if ($this->shouldAttachPreviewToken($app, $viewerUserId)) {
            $token = $this->issueAccessToken($app, (int) $viewerUserId);
            $url .= (str_contains($url, '?') ? '&' : '?').'preview_token='.rawurlencode($token);
        }

        return $url;
    }

    /**
     * 토큰이 필요 없는 안정적 프리뷰 URL — 뷰어별 토큰 없이 캐시·목록에 안전하게 실을 수 있다.
     * 공개(published) standard AI 앱만 해당. hosted/비공개/웹사이트연결은 null.
     * 프론트 openSeed 가 show 완료 전 iframe 을 병렬 시작하는 데 사용.
     */
    public function buildPreviewUrlIfTokenFree(GeneratedApp $app): ?string
    {
        // 웹사이트 연결은 openSeed.websiteUrl 로 이미 즉시 시작 — 여기서 별도 시드 불필요.
        if ((string) ($app->app_type ?? '') === AppType::WebsiteLink->value) {
            return null;
        }

        // hosted 는 scope 토큰이 항상 필요.
        if ($this->tierOf($app) === AppTier::Hosted) {
            return null;
        }

        // 비공개 standard 는 접근 토큰이 필요.
        if (! GeneratedAppPublishPolicy::isPublished($app)) {
            return null;
        }

        // 공개 standard: viewerUserId=null → 토큰 미부착 안정 URL.
        $url = $this->buildPreviewUrl($app, null);

        return $url !== '' ? $url : null;
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
    public function previewResponseHeaders(GeneratedApp $app, ?string $previewToken = null): array
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

        // 공개·무토큰 HTML 은 브라우저 재오픈 캐시 허용. 토큰 URL 은 private.
        $hasToken = is_string($previewToken) && $previewToken !== '';
        $cacheControl = (! $hasToken && GeneratedAppPublishPolicy::isPublished($app))
            ? 'public, max-age=300'
            : 'private, max-age=60';

        return [
            'Content-Security-Policy' => 'frame-ancestors '.implode(' ', $ancestors),
            // 생성앱 origin(apps.mek360.com / {id}.apps.mek360.com)을 부모(테넌트 셸)와
            // 같은 site(mek360.com)여도 별도 agent cluster(독립 이벤트 루프·프로세스)로 격리한다.
            // 앱 내부 무한 루프가 부모 탭/브라우저까지 멈추는 것을 차단한다.
            'Origin-Agent-Cluster' => '?1',
            'Cache-Control' => $cacheControl,
        ];
    }

    public function previewHtml(GeneratedApp $app, ?string $previewToken): string
    {
        $isHosted = $this->tierOf($app) === AppTier::Hosted;
        $dataScope = $this->resolveDataScope($app, $previewToken);

        // 결정적(공개 standard·무토큰·스코프 없음) HTML 은 harden 결과를 캐시한다.
        // scope/hosted 브릿지가 없어 출력이 $app->html 에만 의존 — 콘텐츠 해시로 자동 무효화.
        $isDeterministic = ! $isHosted
            && $dataScope === null
            && ($previewToken === null || $previewToken === '')
            && GeneratedAppPublishPolicy::isPublished($app);

        if (! $isDeterministic) {
            return $this->htmlService->harden((string) $app->html, $dataScope, $isHosted);
        }

        $html = (string) $app->html;
        $contentHash = substr(sha1($html), 0, 16);
        $scope = MoabomPublicApiCacheKeys::tenantScopeToken();
        $localKey = sprintf('moabom.apps.preview_html:%s:%d:%s', $scope, $app->id, $contentHash);
        $sharedObject = sprintf(
            'moabom/apps-preview-cache/%s/%d.json',
            preg_replace('/[^A-Za-z0-9_.-]/', '_', $scope) ?: '_',
            $app->id,
        );

        return (string) MoabomPublicApiCache::rememberShared(
            $localKey,
            $sharedObject,
            fn (): string => $this->htmlService->harden($html, null, false),
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

    private function websiteLinkExternalUrl(GeneratedApp $app): ?string
    {
        $metadata = is_array($app->metadata) ? $app->metadata : [];
        $raw = trim((string) ($metadata['website_url'] ?? ''));
        if ($raw === '') {
            return null;
        }

        try {
            return $this->websiteLinkUrlGuard->normalizeUrl($raw);
        } catch (\InvalidArgumentException) {
            return null;
        }
    }

    private function shouldAttachPreviewToken(GeneratedApp $app, ?int $viewerUserId): bool
    {
        if ($viewerUserId === null) {
            return false;
        }

        // Hosted data API 는 scope 토큰이 필요 — 공개여도 부착.
        if ($this->tierOf($app) === AppTier::Hosted) {
            return true;
        }

        // 공개 HTML 은 dedicated host 에서 무토큰 서빙 가능 — Crypt·캐시 무력화 방지.
        if (GeneratedAppPublishPolicy::isPublished($app)) {
            return false;
        }

        return true;
    }

    private function tierOf(GeneratedApp $app): AppTier
    {
        return AppTier::tryFrom((string) ($app->tier ?? AppTier::Standard->value)) ?? AppTier::Standard;
    }
}
