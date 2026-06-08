<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Branding;

use App\Contracts\Repositories\AttachmentRepositoryInterface;
use App\Contracts\Repositories\ConfigRepositoryInterface;
use App\Models\Attachment;

/**
 * site_logo 컬렉션(DB) → general.json site_logo ID 배열 동기화.
 *
 * G7 SettingsService::getSiteLogoAttachment()는 JSON ID만 조회하므로,
 * 업로드 후 이 동기화가 없으면 새로고침 시 로고가 비어 보입니다.
 * TenantSiteLogoBootstrapper·관리자 설정 저장과 동일한 SSOT 경로입니다.
 */
final class SiteLogoGeneralConfigSync
{
    public function __construct(
        private readonly AttachmentRepositoryInterface $attachmentRepository,
        private readonly ConfigRepositoryInterface $configRepository,
    ) {}

    public function syncFromCollection(): bool
    {
        $ids = $this->collectAttachmentIds();

        $general = $this->configRepository->getCategory('general');
        $existing = $general['site_logo'] ?? [];
        if (! is_array($existing)) {
            $existing = [];
        }

        $existingIds = array_values(array_map('intval', $existing));
        if ($existingIds === $ids) {
            return true;
        }

        $general['site_logo'] = $ids;

        return $this->configRepository->saveCategory('general', $general);
    }

    /**
     * @return list<int>
     */
    private function collectAttachmentIds(): array
    {
        return $this->attachmentRepository
            ->getByCollection(SiteLogoIdentifiers::COLLECTION)
            ->sortBy(fn (Attachment $attachment) => [(int) $attachment->order, (int) $attachment->id])
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();
    }
}
