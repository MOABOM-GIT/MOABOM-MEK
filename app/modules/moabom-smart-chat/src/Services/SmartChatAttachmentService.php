<?php

namespace Modules\Moabom\Smart\Chat\Services;

use App\Contracts\Extension\StorageInterface;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Modules\Moabom\Smart\Chat\Models\SmartChatAttachment;

/**
 * 스마트챗 첨부 — 모듈 스토리지 category `smart-chat`.
 * 이미지: multimodal / 문서(txt·md·csv·pdf): 텍스트 추출(가능 시).
 */
class SmartChatAttachmentService
{
    public const STORAGE_CATEGORY = 'smart-chat';

    private const IMAGE_MIMES = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
    ];

    private const DOCUMENT_MIMES = [
        'text/plain',
        'text/markdown',
        'text/csv',
        'application/pdf',
        'application/csv',
    ];

    public function __construct(
        private readonly StorageInterface $storage,
    ) {}

    public function upload(User $user, UploadedFile $file, ?int $conversationId = null): SmartChatAttachment
    {
        $mime = (string) ($file->getMimeType() ?: 'application/octet-stream');
        $kind = $this->resolveKind($mime, (string) $file->getClientOriginalExtension());
        if ($kind === null) {
            throw new InvalidArgumentException('messages.attachment.unsupported_type');
        }

        $maxBytes = $kind === 'image'
            ? (int) config('moabom-smart-chat.attachments.max_image_bytes', 10 * 1024 * 1024)
            : (int) config('moabom-smart-chat.attachments.max_document_bytes', 8 * 1024 * 1024);

        if ($file->getSize() > $maxBytes) {
            throw new InvalidArgumentException('messages.attachment.too_large');
        }

        $uuid = (string) Str::uuid();
        $ext = strtolower((string) $file->getClientOriginalExtension()) ?: 'bin';
        $path = $user->id.'/'.$uuid.'.'.$ext;
        $bytes = file_get_contents($file->getRealPath());
        if ($bytes === false || ! $this->storage->put(self::STORAGE_CATEGORY, $path, $bytes)) {
            throw new InvalidArgumentException('messages.attachment.upload_failed');
        }

        $extracted = null;
        if ($kind === 'document') {
            $extracted = $this->extractDocumentText($mime, $bytes, (string) $file->getClientOriginalName());
        }

        return SmartChatAttachment::query()->create([
            'user_id' => $user->id,
            'conversation_id' => $conversationId,
            'uuid' => $uuid,
            'original_name' => mb_substr((string) $file->getClientOriginalName(), 0, 255),
            'mime' => $mime,
            'kind' => $kind,
            'size_bytes' => (int) $file->getSize(),
            'storage_path' => $path,
            'extracted_text' => $extracted,
        ]);
    }

    /**
     * @param  list<string>  $uuids
     * @return list<SmartChatAttachment>
     */
    public function findOwnedByUuids(User $user, array $uuids): array
    {
        $uuids = array_values(array_unique(array_filter($uuids)));
        if ($uuids === []) {
            return [];
        }

        $max = (int) config('moabom-smart-chat.attachments.max_per_turn', 4);

        return SmartChatAttachment::query()
            ->where('user_id', $user->id)
            ->whereIn('uuid', $uuids)
            ->orderBy('id')
            ->limit($max)
            ->get()
            ->all();
    }

    public function readBinary(SmartChatAttachment $attachment): ?string
    {
        if (! $this->storage->exists(self::STORAGE_CATEGORY, $attachment->storage_path)) {
            return null;
        }

        $data = $this->storage->get(self::STORAGE_CATEGORY, $attachment->storage_path);

        return is_string($data) ? $data : null;
    }

    public function serialize(SmartChatAttachment $a): array
    {
        return [
            'uuid' => $a->uuid,
            'original_name' => $a->original_name,
            'mime' => $a->mime,
            'kind' => $a->kind,
            'size_bytes' => $a->size_bytes,
            'has_extracted_text' => $a->extracted_text !== null && $a->extracted_text !== '',
        ];
    }

    private function resolveKind(string $mime, string $ext): ?string
    {
        $ext = strtolower($ext);
        if (in_array($mime, self::IMAGE_MIMES, true) || in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true)) {
            return 'image';
        }
        if (in_array($mime, self::DOCUMENT_MIMES, true) || in_array($ext, ['txt', 'md', 'csv', 'pdf'], true)) {
            return 'document';
        }

        return null;
    }

    private function extractDocumentText(string $mime, string $bytes, string $name): ?string
    {
        $maxChars = (int) config('moabom-smart-chat.attachments.max_extracted_chars', 40000);
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));

        if ($mime === 'application/pdf' || $ext === 'pdf') {
            // 패키지 없이 스캔 PDF는 불가. 텍스트 PDF에서만 단순 추출 시도.
            $text = $this->extractPdfTextRough($bytes);
            if ($text === null || trim($text) === '') {
                return null;
            }

            return mb_substr($text, 0, $maxChars);
        }

        // txt/md/csv
        if (! mb_check_encoding($bytes, 'UTF-8')) {
            $bytes = mb_convert_encoding($bytes, 'UTF-8', 'UTF-8, EUC-KR, ISO-8859-1');
        }

        return mb_substr($bytes, 0, $maxChars);
    }

    private function extractPdfTextRough(string $bytes): ?string
    {
        if (! str_starts_with($bytes, '%PDF')) {
            return null;
        }

        $out = '';
        if (preg_match_all('/\\((?:\\\\.|[^\\\\)])*\\)/s', $bytes, $m)) {
            foreach ($m[0] as $token) {
                $chunk = substr($token, 1, -1);
                $chunk = str_replace(['\\n', '\\r', '\\t', '\\(', '\\)'], ["\n", "\r", "\t", '(', ')'], $chunk);
                if (preg_match('/[\\x20-\\x7E가-힣]{3,}/u', $chunk)) {
                    $out .= $chunk."\n";
                }
            }
        }

        $out = trim($out);

        return $out !== '' ? $out : null;
    }
}
