<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use App\Contracts\Repositories\AttachmentRepositoryInterface;
use App\Enums\AttachmentSourceType;
use App\Models\Attachment;
use App\Services\AttachmentService;
use Illuminate\Http\UploadedFile;
use Modules\Moabom\System\Branding\SiteLogoGeneralConfigSync;
use Modules\Moabom\System\Branding\SiteLogoIdentifiers;
use Modules\Moabom\System\Branding\SiteLogoPublicCacheInvalidator;

/**
 * 테넌트 프로비저닝·플랫폼 API에서 site_logo 라이트/다크 업로드 및 general.json 동기화.
 */
final class TenantSiteLogoBootstrapper
{
    public function __construct(
        private readonly TenantDatabaseConfigurator $databaseConfigurator,
        private readonly TenantFilesystemConfigurator $filesystemConfigurator,
        private readonly TenantContext $tenantContext,
        private readonly PlatformRuntimeConfigurator $platformRuntimeConfigurator,
        private readonly AttachmentService $attachmentService,
        private readonly AttachmentRepositoryInterface $attachmentRepository,
        private readonly SiteLogoGeneralConfigSync $siteLogoGeneralConfigSync,
        private readonly SiteLogoPublicCacheInvalidator $siteLogoPublicCacheInvalidator,
    ) {}

    public function apply(TenantRecord $tenant, ?UploadedFile $light, ?UploadedFile $dark): void
    {
        if ($light === null && $dark === null) {
            return;
        }

        try {
            $this->databaseConfigurator->apply($tenant);
            $this->filesystemConfigurator->apply($tenant);
            $this->tenantContext->setTenant($tenant, $tenant->host);

            if ($light !== null) {
                $this->replaceVariant(SiteLogoIdentifiers::VARIANT_LIGHT, $light);
            }

            if ($dark !== null) {
                $this->replaceVariant(SiteLogoIdentifiers::VARIANT_DARK, $dark);
            }

            if (! $this->siteLogoGeneralConfigSync->syncFromCollection()) {
                throw new \RuntimeException('general.json site_logo 동기화 실패');
            }

            $this->siteLogoPublicCacheInvalidator->invalidate();
        } finally {
            $this->platformRuntimeConfigurator->applyPlatform();
        }
    }

    private function replaceVariant(string $variant, UploadedFile $file): void
    {
        $sourceIdentifier = SiteLogoIdentifiers::sourceIdentifierForVariant($variant);
        if ($sourceIdentifier === null) {
            return;
        }

        $this->deleteExistingForVariant($variant, $sourceIdentifier);

        $attachment = $this->attachmentService->upload(
            file: $file,
            collection: SiteLogoIdentifiers::COLLECTION,
            sourceType: AttachmentSourceType::Core,
            sourceIdentifier: $sourceIdentifier,
        );

        $meta = is_array($attachment->meta) ? $attachment->meta : [];
        $meta['variant'] = $variant;

        $attachment->update([
            'order' => SiteLogoIdentifiers::orderForVariant($variant),
            'meta' => $meta,
        ]);
    }

    private function deleteExistingForVariant(string $variant, string $sourceIdentifier): void
    {
        $existing = $this->attachmentRepository->getByCollection(SiteLogoIdentifiers::COLLECTION);

        foreach ($existing as $attachment) {
            if ($this->matchesVariant($attachment, $variant, $sourceIdentifier)) {
                $this->attachmentService->delete((int) $attachment->id);
            }
        }
    }

    private function matchesVariant(Attachment $attachment, string $variant, string $sourceIdentifier): bool
    {
        if ($attachment->source_identifier === $sourceIdentifier) {
            return true;
        }

        $meta = is_array($attachment->meta) ? $attachment->meta : [];

        return ($meta['variant'] ?? null) === $variant
            || (int) $attachment->order === SiteLogoIdentifiers::orderForVariant($variant);
    }

}
