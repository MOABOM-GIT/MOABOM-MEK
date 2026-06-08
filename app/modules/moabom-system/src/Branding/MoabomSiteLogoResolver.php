<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Branding;

use App\Contracts\Repositories\AttachmentRepositoryInterface;
use App\Models\Attachment;

/**
 * general.site_logo + site_logo 컬렉션 → 라이트/다크 URL (폴백: moabom-basic 템플릿 SVG).
 */
final class MoabomSiteLogoResolver
{
    public function __construct(
        private readonly AttachmentRepositoryInterface $attachmentRepository,
    ) {}

    /**
     * @param  list<int>|null  $siteLogoIds  general.site_logo ID 배열
     * @return array{
     *   light_url: string,
     *   dark_url: string,
     *   has_custom_light: bool,
     *   has_custom_dark: bool,
     *   site_logo_url: string,
     * }
     */
    public function resolve(?array $siteLogoIds = null): array
    {
        $attachments = $this->loadAttachments($siteLogoIds);

        $light = $this->findForVariant($attachments, SiteLogoIdentifiers::VARIANT_LIGHT);
        $dark = $this->findForVariant($attachments, SiteLogoIdentifiers::VARIANT_DARK);

        $lightUrl = $light?->download_url ?? SiteLogoIdentifiers::FALLBACK_LIGHT_URL;
        $darkUrl = $dark?->download_url ?? SiteLogoIdentifiers::FALLBACK_DARK_URL;

        return [
            'light_url' => $lightUrl,
            'dark_url' => $darkUrl,
            'has_custom_light' => $light !== null,
            'has_custom_dark' => $dark !== null,
            'site_logo_url' => $lightUrl,
        ];
    }

    /**
     * @param  list<int>|null  $siteLogoIds
     * @return list<Attachment>
     */
    private function loadAttachments(?array $siteLogoIds): array
    {
        if (is_array($siteLogoIds) && $siteLogoIds !== []) {
            $ids = array_values(array_filter(array_map('intval', $siteLogoIds)));

            return $this->attachmentRepository
                ->findByIds($ids)
                ->filter(fn (Attachment $attachment) => $attachment->collection === SiteLogoIdentifiers::COLLECTION)
                ->values()
                ->all();
        }

        return $this->attachmentRepository
            ->getByCollection(SiteLogoIdentifiers::COLLECTION)
            ->all();
    }

    /**
     * @param  list<Attachment>  $attachments
     */
    private function findForVariant(array $attachments, string $variant): ?Attachment
    {
        $sourceId = SiteLogoIdentifiers::sourceIdentifierForVariant($variant);
        $expectedOrder = SiteLogoIdentifiers::orderForVariant($variant);

        foreach ($attachments as $attachment) {
            if ($attachment->source_identifier === $sourceId) {
                return $attachment->is_image ? $attachment : null;
            }

            $meta = is_array($attachment->meta) ? $attachment->meta : [];
            if (($meta['variant'] ?? null) === $variant && $attachment->is_image) {
                return $attachment;
            }
        }

        foreach ($attachments as $attachment) {
            if ((int) $attachment->order === $expectedOrder && $attachment->is_image) {
                return $attachment;
            }
        }

        if ($variant === SiteLogoIdentifiers::VARIANT_LIGHT) {
            foreach ($attachments as $attachment) {
                if ($attachment->is_image) {
                    return $attachment;
                }
            }
        }

        return null;
    }
}
