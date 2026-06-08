<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Listeners;

use App\Contracts\Extension\HookListenerInterface;
use App\Contracts\Repositories\AttachmentRepositoryInterface;
use App\Models\Attachment;
use App\Services\AttachmentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Modules\Moabom\System\Branding\SiteLogoGeneralConfigSync;
use Modules\Moabom\System\Branding\SiteLogoIdentifiers;
use Modules\Moabom\System\Branding\SiteLogoPublicCacheInvalidator;

/**
 * site_logo 업로드 시 variant·order 정규화 및 동일 슬롯 교체.
 */
final class SiteLogoAttachmentListener implements HookListenerInterface
{
    public function __construct(
        private readonly AttachmentRepositoryInterface $attachmentRepository,
        private readonly AttachmentService $attachmentService,
        private readonly SiteLogoGeneralConfigSync $siteLogoGeneralConfigSync,
        private readonly SiteLogoPublicCacheInvalidator $siteLogoPublicCacheInvalidator,
    ) {}

    public static function getSubscribedHooks(): array
    {
        return [
            'core.attachment.after_upload' => [
                'method' => 'onAfterUpload',
                'priority' => 10,
                'sync' => true,
            ],
            'core.attachment.upload_validation_rules' => [
                'method' => 'extendUploadValidationRules',
                'priority' => 10,
                'type' => 'filter',
            ],
        ];
    }

    public function handle(...$args): void
    {
        // HookListenerInterface 필수
    }

    /**
     * @param  array<string, mixed>  $rules
     * @return array<string, mixed>
     */
    public function extendUploadValidationRules(array $rules, Request $request): array
    {
        if ($request->input('collection') !== SiteLogoIdentifiers::COLLECTION) {
            return $rules;
        }

        $rules['source_identifier'] = ['nullable', 'string', 'max:255'];

        return $rules;
    }

    public function onAfterUpload(Attachment $attachment): void
    {
        if ($attachment->collection !== SiteLogoIdentifiers::COLLECTION) {
            return;
        }

        // source_identifier 는 코어 AttachmentService 가 업로드 시점에 모델로 영속화한다
        // (관리자 업로드 컨트롤러 → 검증된 request 의 source_identifier 를 서비스에 전달).
        // Listener 는 request() 를 직접 보지 않고, 전달받은 도메인 객체(Attachment)에서만 해석한다.
        $variant = SiteLogoIdentifiers::variantFromSourceIdentifier($attachment->source_identifier);
        if ($variant === null) {
            return;
        }

        $sourceIdentifier = SiteLogoIdentifiers::sourceIdentifierForVariant($variant);
        $this->removeDuplicates($attachment, $variant, $sourceIdentifier);

        $meta = is_array($attachment->meta) ? $attachment->meta : [];
        $meta['variant'] = $variant;

        // Model 직접 save 금지 — Repository 위임 (AGENTS.md "Listener 데이터 접근").
        $this->attachmentRepository->update((int) $attachment->id, [
            'source_identifier' => $sourceIdentifier,
            'order' => SiteLogoIdentifiers::orderForVariant($variant),
            'meta' => $meta,
        ]);

        if (! $this->siteLogoGeneralConfigSync->syncFromCollection()) {
            Log::warning('site_logo: general.json ID 동기화 실패', ['attachment_id' => $attachment->id]);
        } else {
            $this->siteLogoPublicCacheInvalidator->invalidate();
        }
    }

    private function removeDuplicates(Attachment $keep, string $variant, ?string $sourceIdentifier): void
    {
        $existing = $this->attachmentRepository->getByCollection(SiteLogoIdentifiers::COLLECTION);

        foreach ($existing as $other) {
            if ($other->id === $keep->id) {
                continue;
            }

            if ($sourceIdentifier !== null && $other->source_identifier === $sourceIdentifier) {
                $this->attachmentService->delete((int) $other->id);

                continue;
            }

            $meta = is_array($other->meta) ? $other->meta : [];
            if (($meta['variant'] ?? null) === $variant) {
                $this->attachmentService->delete((int) $other->id);
            }
        }
    }
}
