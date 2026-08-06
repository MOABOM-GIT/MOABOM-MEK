<?php

namespace Modules\Moabom\Smart\Chat\Services;

use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Modules\Moabom\Smart\Chat\Models\SmartChatAttachment;
use Modules\Moabom\Smart\Chat\Models\SmartChatConversation;
use Modules\Moabom\Smart\Chat\Models\SmartChatMessage;

class SmartChatService
{
    public function __construct(
        private readonly SmartChatLlmService $llm,
        private readonly SmartChatCreditGate $creditGate,
        private readonly SmartChatStreamConcurrencyService $concurrency,
        private readonly SmartChatAttachmentService $attachments,
        private readonly SmartChatPreferenceService $preferences,
        private readonly SmartChatToolRegistry $tools,
        private readonly SmartChatMemoryService $memories,
        private readonly SmartChatShareService $shares,
        private readonly SmartChatFolderService $folders,
    ) {}

    /**
     * @return list<array<string, mixed>>
     */
    public function listConversations(User $user, int $limit = 50, ?string $folderUuid = null): array
    {
        $limit = max(1, min(100, $limit));
        $query = SmartChatConversation::query()
            ->with('folder')
            ->where('user_id', $user->id);

        if ($folderUuid === 'none') {
            $query->whereNull('folder_id');
        } elseif (is_string($folderUuid) && $folderUuid !== '') {
            $folder = $this->folders->findOwned($user, $folderUuid);
            if ($folder === null) {
                return [];
            }
            $query->where('folder_id', $folder->id);
        }

        return $query
            ->orderByDesc('last_message_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(fn (SmartChatConversation $c) => $this->serializeConversation($c))
            ->values()
            ->all();
    }

    public function createConversation(User $user, ?string $modelId = null, ?string $folderUuid = null): SmartChatConversation
    {
        $modelId = $this->normalizeModelId($modelId);
        $folderId = null;
        if (is_string($folderUuid) && $folderUuid !== '') {
            $folder = $this->folders->findOwned($user, $folderUuid);
            if ($folder === null) {
                throw new InvalidArgumentException('messages.folders.not_found');
            }
            $folderId = $folder->id;
        }

        return SmartChatConversation::query()->create([
            'user_id' => $user->id,
            'uuid' => (string) Str::uuid(),
            'title' => null,
            'model_id' => $modelId,
            'folder_id' => $folderId,
            'last_message_at' => now(),
        ]);
    }

    public function moveConversation(SmartChatConversation $conversation, User $user, ?string $folderUuid): SmartChatConversation
    {
        if ($folderUuid === null || $folderUuid === '' || $folderUuid === 'none') {
            $conversation->folder_id = null;
        } else {
            $folder = $this->folders->findOwned($user, $folderUuid);
            if ($folder === null) {
                throw new InvalidArgumentException('messages.folders.not_found');
            }
            $conversation->folder_id = $folder->id;
        }
        $conversation->save();

        return $conversation->load('folder');
    }

    public function findOwned(User $user, string $uuid): ?SmartChatConversation
    {
        return SmartChatConversation::query()
            ->where('user_id', $user->id)
            ->where('uuid', $uuid)
            ->first();
    }

    public function deleteConversation(SmartChatConversation $conversation): void
    {
        $conversation->delete();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listMessages(SmartChatConversation $conversation, int $limit = 100): array
    {
        $limit = max(1, min(200, $limit));

        return SmartChatMessage::query()
            ->where('conversation_id', $conversation->id)
            ->orderBy('id')
            ->limit($limit)
            ->get()
            ->map(fn (SmartChatMessage $m) => $this->serializeMessage($m))
            ->values()
            ->all();
    }

    /**
     * @param  list<string>  $attachmentUuids
     * @param  list<string>|null  $requestedTools
     * @param  callable(string, array<string, mixed>): void  $emit
     * @return array<string, mixed>
     */
    public function streamTurn(
        User $user,
        SmartChatConversation $conversation,
        string $userText,
        ?string $modelId,
        array $attachmentUuids,
        callable $emit,
        ?int $parentId = null,
        ?int $generatedAppId = null,
        ?array $requestedTools = null,
        bool $webSearch = false,
    ): array {
        $userText = trim($userText);
        $ownedAttachments = $this->attachments->findOwnedByUuids($user, $attachmentUuids);
        if ($userText === '' && $ownedAttachments === []) {
            throw new \InvalidArgumentException(__('moabom-smart-chat::messages.validation.content_required'));
        }
        if ($userText === '') {
            $userText = __('moabom-smart-chat::messages.attachment.default_prompt');
        }

        if ($parentId !== null) {
            $parent = SmartChatMessage::query()
                ->where('conversation_id', $conversation->id)
                ->where('id', $parentId)
                ->where('role', 'assistant')
                ->where('status', 'complete')
                ->first();
            if ($parent === null) {
                throw new \InvalidArgumentException(__('moabom-smart-chat::messages.messages.parent_not_found'));
            }
        }

        $modelId = $this->normalizeModelId($modelId ?? $conversation->model_id);

        // 사이트 데이터는 function calling(pull)로 전환 — requestedTools 는 구 클라이언트 호환용으로만 수신
        unset($requestedTools);

        // 웹검색은 턴 플래그로 허용 여부만 결정 — 실제 실행은 LLM 의 search_web 호출 (pull).
        // preflight 는 허용 기준, settle 은 실제 실행 기준으로 서차지.
        $willWebSearch = $webSearch;
        $credit = $this->creditGate->preflight($user, count($ownedAttachments), $willWebSearch);

        $gate = $this->concurrency->acquire($user->id);
        if (! ($gate['ok'] ?? false)) {
            throw new \RuntimeException(__('moabom-smart-chat::messages.stream.busy'));
        }
        $lease = (string) ($gate['lease_token'] ?? '');

        $toolBundle = $this->tools->assemble($user, $generatedAppId);
        $partsMeta = array_map(
            fn (SmartChatAttachment $a) => [
                'uuid' => $a->uuid,
                'name' => $a->original_name,
                'mime' => $a->mime,
                'kind' => $a->kind,
            ],
            $ownedAttachments,
        );

        $userMessage = SmartChatMessage::query()->create([
            'conversation_id' => $conversation->id,
            'role' => 'user',
            'content' => $userText,
            'parts' => $partsMeta === [] ? null : $partsMeta,
            'status' => 'complete',
            'model_id' => $modelId,
            'parent_id' => $parentId,
        ]);

        foreach ($ownedAttachments as $attachment) {
            $attachment->conversation_id = $conversation->id;
            $attachment->message_id = $userMessage->id;
            $attachment->save();
        }

        $assistant = SmartChatMessage::query()->create([
            'conversation_id' => $conversation->id,
            'role' => 'assistant',
            'content' => '',
            'status' => 'streaming',
            'model_id' => $modelId,
            'parent_id' => $userMessage->id,
        ]);

        $emit('meta', [
            'conversation_uuid' => $conversation->uuid,
            'user_message_id' => $userMessage->id,
            'assistant_message_id' => $assistant->id,
            'model_id' => $modelId,
            'credit' => $credit,
            'attachments' => array_map(fn (SmartChatAttachment $a) => $this->attachments->serialize($a), $ownedAttachments),
            'tools' => $toolBundle['used_tools'],
            'web_search' => $willWebSearch,
            'sources' => [],
            'generated_app' => $toolBundle['generated_app'],
            'parent_id' => $parentId,
        ]);

        try {
            $history = $this->buildHistory($conversation, $userMessage->id, $parentId);
            $custom = $this->preferences->getCustomInstructions($user);
            // 최소 컨텍스트 한 줄 — 닉네임 호칭·현재 시각 (그 외 데이터는 도구 호출로 pull)
            $nickname = trim((string) ($user->nickname ?? '')) ?: trim((string) ($user->name ?? ''));
            $contextLine = '[context] now: '.now()->toIso8601String();
            if ($nickname !== '') {
                $contextLine .= ' | user nickname: '.$nickname.' (address the user by this nickname)';
            }
            $custom = trim($contextLine."\n\n".$custom);
            $memoryBlock = $this->memories->contextBlock($user);
            if ($memoryBlock !== '') {
                $custom = trim($custom."\n\n".$memoryBlock);
            }
            if ($toolBundle['blocks'] !== []) {
                $custom = trim($custom."\n\n".implode("\n\n", $toolBundle['blocks']));
            }

            // search_web 실행 결과에서 출처·실제 실행 여부 수집 (정산·done payload 용)
            $didWebSearch = false;
            $webSources = [];
            $executeTool = function (string $name, array $args) use ($user, &$didWebSearch, &$webSources): array {
                $result = $this->tools->executeFunction($user, $name, $args);
                if ($name === SmartChatToolRegistry::WEB_SEARCH_FUNCTION && ! isset($result['error'])) {
                    $didWebSearch = true;
                    foreach ((array) ($result['sources'] ?? []) as $source) {
                        if (is_array($source) && isset($source['url'])) {
                            $webSources[(string) $source['url']] = $source;
                        }
                    }
                }

                return $result;
            };

            $result = $this->llm->streamChat(
                $modelId,
                $history,
                $emit,
                $custom,
                $this->tools->functionSpecs($willWebSearch),
                $executeTool,
            );
            $content = (string) ($result['content'] ?? '');
            $usedTools = array_values(array_unique(array_merge(
                $toolBundle['used_tools'],
                (array) ($result['used_tools'] ?? []),
            )));
            $finish = (string) ($result['finish_reason'] ?? '');
            $promptTokens = isset($result['prompt_tokens']) ? (int) $result['prompt_tokens'] : null;
            $completionTokens = isset($result['completion_tokens']) ? (int) $result['completion_tokens'] : null;
            $isUpstreamError = in_array($finish, ['no_key', 'error', 'unsupported'], true);
            $status = $finish === 'cancelled'
                ? 'cancelled'
                : ($content === '' || $isUpstreamError ? 'error' : 'complete');

            $assistant->content = $content;
            $assistant->status = $status;
            $assistant->prompt_tokens = $promptTokens;
            $assistant->completion_tokens = $completionTokens;
            $assistant->save();

            if ($conversation->title === null || $conversation->title === '') {
                $conversation->title = $this->autoTitle($userText);
            }
            $conversation->model_id = $modelId;
            $conversation->last_message_at = now();
            $conversation->save();

            $creditSettled = false;
            $creditError = null;
            if ($status === 'complete') {
                try {
                    $this->creditGate->settle(
                        $user,
                        (string) $assistant->id,
                        count($ownedAttachments),
                        $didWebSearch,
                        [
                            'conversation_uuid' => $conversation->uuid,
                            'model_id' => $modelId,
                            'provider' => $result['provider'] ?? null,
                            'tools' => $usedTools,
                        ],
                        $promptTokens,
                        $completionTokens,
                    );
                    $creditSettled = true;
                } catch (\Throwable $e) {
                    $creditError = $e->getMessage();
                    \Illuminate\Support\Facades\Log::warning('moabom-smart-chat.credit_settle_failed', [
                        'assistant_id' => $assistant->id,
                        'user_id' => $user->id,
                        'message' => $creditError,
                    ]);
                }
            }

            $emit('done', [
                'assistant_message' => $this->serializeMessage($assistant->fresh()),
                'conversation' => $this->serializeConversation($conversation->fresh(['folder'])),
                'finish_reason' => $finish,
                'tools' => $usedTools,
                'sources' => array_values($webSources),
                'usage' => [
                    'prompt_tokens' => $promptTokens,
                    'completion_tokens' => $completionTokens,
                ],
                'credit' => [
                    'settled' => $creditSettled,
                    'error' => $creditError,
                ],
            ]);

            return [
                'assistant' => $assistant,
                'conversation' => $conversation,
            ];
        } catch (\Throwable $e) {
            $assistant->status = 'error';
            if ($assistant->content === '') {
                $assistant->content = __('moabom-smart-chat::messages.llm.upstream_failed');
            }
            $assistant->save();
            $emit('error', ['message' => $e->getMessage()]);
            throw $e;
        } finally {
            $this->concurrency->release($lease);
        }
    }

    public function serializeConversation(SmartChatConversation $c): array
    {
        if (! $c->relationLoaded('folder') && $c->folder_id) {
            $c->load('folder');
        }

        return [
            'uuid' => $c->uuid,
            'title' => $c->title,
            'model_id' => $c->model_id,
            'folder_uuid' => $c->folder?->uuid,
            'share' => $this->shares->serializeShare($c),
            'last_message_at' => optional($c->last_message_at)?->toIso8601String(),
            'updated_at' => optional($c->updated_at)?->toIso8601String(),
        ];
    }

    public function serializeMessage(SmartChatMessage $m): array
    {
        return [
            'id' => $m->id,
            'role' => $m->role,
            'content' => $m->content,
            'parts' => $m->parts,
            'status' => $m->status,
            'model_id' => $m->model_id,
            'parent_id' => $m->parent_id,
            'prompt_tokens' => $m->prompt_tokens,
            'completion_tokens' => $m->completion_tokens,
            'created_at' => optional($m->created_at)?->toIso8601String(),
        ];
    }

    /**
     * @return list<array{role: string, content: string, parts?: list<array<string, mixed>>}>
     */
    private function buildHistory(
        SmartChatConversation $conversation,
        int $latestUserMessageId,
        ?int $branchParentId = null,
    ): array {
        $max = max(2, (int) config('moabom-smart-chat.max_history_messages', 40));
        $imageTurnBudget = (int) config('moabom-smart-chat.attachments.history_image_turns', 2);

        $query = SmartChatMessage::query()
            ->where('conversation_id', $conversation->id)
            ->whereIn('role', ['user', 'assistant'])
            ->where(function ($q) use ($latestUserMessageId): void {
                $q->where('status', 'complete')
                    ->orWhere('id', $latestUserMessageId);
            });

        // 분기: parent 이후 메시지는 컨텍스트에서 제외 (이 지점에서 다시)
        if ($branchParentId !== null) {
            $query->where(function ($q) use ($branchParentId, $latestUserMessageId): void {
                $q->where('id', '<=', $branchParentId)
                    ->orWhere('id', $latestUserMessageId);
            });
        }

        $messages = $query
            ->orderByDesc('id')
            ->limit($max)
            ->get()
            ->sortBy('id')
            ->values();

        $imageTurnsLeft = $imageTurnBudget;
        $out = [];
        foreach ($messages as $m) {
            /** @var SmartChatMessage $m */
            $entry = [
                'role' => $m->role,
                'content' => (string) $m->content,
            ];
            if ($m->role === 'user' && is_array($m->parts) && $m->parts !== []) {
                $includeBytes = $m->id === $latestUserMessageId || $imageTurnsLeft > 0;
                if ($includeBytes && $m->id !== $latestUserMessageId) {
                    $imageTurnsLeft--;
                }
                $entry['parts'] = $this->resolvePartsForLlm($m, $includeBytes);
            }
            $out[] = $entry;
        }

        return $out;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function resolvePartsForLlm(SmartChatMessage $message, bool $includeBytes): array
    {
        $meta = is_array($message->parts) ? $message->parts : [];
        $uuids = [];
        foreach ($meta as $row) {
            if (! empty($row['uuid'])) {
                $uuids[] = (string) $row['uuid'];
            }
        }

        $byUuid = [];
        if ($uuids !== []) {
            $rows = SmartChatAttachment::query()
                ->where('message_id', $message->id)
                ->whereIn('uuid', $uuids)
                ->get();
            foreach ($rows as $row) {
                $byUuid[$row->uuid] = $row;
            }
        }

        $parts = [];
        foreach ($meta as $row) {
            $uuid = (string) ($row['uuid'] ?? '');
            $attachment = $byUuid[$uuid] ?? null;
            $name = (string) ($row['name'] ?? $attachment?->original_name ?? 'file');
            $mime = (string) ($row['mime'] ?? $attachment?->mime ?? '');
            $kind = (string) ($row['kind'] ?? $attachment?->kind ?? '');

            if ($attachment === null) {
                $parts[] = ['type' => 'file_ref', 'name' => $name];
                continue;
            }

            if ($kind === 'document' && $attachment->extracted_text) {
                $parts[] = [
                    'type' => 'file_text',
                    'name' => $name,
                    'text' => $attachment->extracted_text,
                ];
                continue;
            }

            if (! $includeBytes) {
                $parts[] = ['type' => 'file_ref', 'name' => $name];
                continue;
            }

            $binary = $this->attachments->readBinary($attachment);
            if ($binary === null) {
                $parts[] = ['type' => 'file_ref', 'name' => $name];
                continue;
            }

            if ($kind === 'image') {
                $parts[] = [
                    'type' => 'image',
                    'mime' => $mime,
                    'base64' => base64_encode($binary),
                ];
            } else {
                // PDF 등 — Gemini inline / 타 모델은 텍스트 안내
                $parts[] = [
                    'type' => 'file_binary',
                    'name' => $name,
                    'mime' => $mime ?: 'application/pdf',
                    'base64' => base64_encode($binary),
                ];
            }
        }

        return $parts;
    }

    private function normalizeModelId(?string $modelId): string
    {
        $fallback = (string) config('moabom-smart-chat.default_model_id', 'gemini-flash-lite');
        if ($modelId === null || $modelId === '') {
            return $fallback;
        }
        $allowed = (array) config('moabom-smart-chat.allowed_model_ids', []);

        return in_array($modelId, $allowed, true) ? $modelId : $fallback;
    }

    /**
     * "이 답으로 앱 만들기" — 질문+답변을 AI 앱 생성기용 제목·제작 프롬프트로 요약한다.
     * LLM 실패 시에도 UX 가 끊기지 않도록 구조화된 폴백을 반환한다.
     *
     * @return array{title: string, prompt: string}
     */
    public function buildAppHandoffPrompt(string $question, string $answer): array
    {
        $question = mb_substr(preg_replace('/\s+/u', ' ', trim($question)) ?? '', 0, 2000);
        $answer = mb_substr(trim($answer), 0, 8000);
        $fallbackTitle = $this->fallbackAppHandoffTitle($question, $answer);
        $fallbackPrompt = "다음 질문과 답변 내용을 바탕으로 사용하기 쉬운 웹앱을 만들어줘.\n\n[질문]\n"
            .($question !== '' ? $question : '(질문 없음)')."\n\n[답변 요약]\n".mb_substr($answer, 0, 1500);

        $instruction = "아래 대화의 질문과 답변을 바탕으로, AI 웹앱 생성기에 넣을 앱 이름과 제작 프롬프트를 작성해줘.\n\n"
            ."규칙:\n"
            ."- 답변 내용을 그대로 복사하지 말고, 만들 앱의 목적·핵심 기능·화면 구성·필요한 데이터 항목으로 재구성해 요약한다.\n"
            ."- 앱 이름은 8~24자 명사구로, 사용자가 앱 목록에서 바로 알아볼 수 있게 짓는다.\n"
            ."- 제작 프롬프트는 명령형으로 600자 이내로 쓴다.\n"
            ."- 인사말·설명·머리말 없이 아래 형식만 출력한다.\n"
            ."- 질문과 답변에 쓰인 언어로 작성한다.\n\n"
            ."출력 형식(두 줄):\n"
            ."TITLE: <앱 이름>\n"
            ."PROMPT: <제작 프롬프트 본문>\n\n"
            ."[질문]\n".($question !== '' ? $question : '(질문 없음)')."\n\n[답변]\n".$answer;

        try {
            $result = $this->llm->streamChat(
                (string) config('moabom-smart-chat.default_model_id', 'gemini-flash-lite'),
                [['role' => 'user', 'content' => $instruction]],
                static function (): void {},
            );
            $parsed = $this->parseAppHandoffLlmOutput(trim($result['content']));
            if ($parsed['prompt'] !== '') {
                return [
                    'title' => $parsed['title'] !== '' ? $parsed['title'] : $fallbackTitle,
                    'prompt' => mb_substr($parsed['prompt'], 0, 2000),
                ];
            }
        } catch (\Throwable $e) {
            Log::warning('moabom-smart-chat.handoff_prompt_failed', ['message' => $e->getMessage()]);
        }

        return [
            'title' => $fallbackTitle,
            'prompt' => $fallbackPrompt,
        ];
    }

    /**
     * @return array{title: string, prompt: string}
     */
    private function parseAppHandoffLlmOutput(string $raw): array
    {
        $title = '';
        $prompt = '';

        if (preg_match('/^\s*TITLE:\s*(.+)$/mi', $raw, $titleMatch) === 1) {
            $title = trim($titleMatch[1] ?? '');
        }
        if (preg_match('/^\s*PROMPT:\s*([\s\S]+)$/mi', $raw, $promptMatch) === 1) {
            $prompt = trim($promptMatch[1] ?? '');
        }

        if ($prompt === '' && $raw !== '' && ! preg_match('/^\s*TITLE:/mi', $raw)) {
            $prompt = $raw;
        }

        $title = mb_substr(preg_replace('/\s+/u', ' ', $title) ?? '', 0, 80);

        return [
            'title' => $title,
            'prompt' => $prompt,
        ];
    }

    private function fallbackAppHandoffTitle(string $question, string $answer): string
    {
        $source = $question !== '' ? $question : $answer;
        $oneLine = preg_replace('/\s+/u', ' ', trim($source)) ?? '';
        if ($oneLine === '') {
            return '새 앱';
        }
        if (mb_strlen($oneLine) <= 24) {
            return $oneLine;
        }

        return mb_substr($oneLine, 0, 24);
    }

    /**
     * "기억하기" — 답변 전체가 아니라 오래 기억할 가치가 있는 핵심 팩트만 추려 요약한다.
     * LLM 실패 시 원문을 그대로 반환 (MemoryService 가 max_chars 로 자름).
     */
    public function summarizeMemoryFacts(string $content): string
    {
        $content = mb_substr(trim($content), 0, 8000);
        $max = (int) config('moabom-smart-chat.memory.max_chars', 500);

        $instruction = "아래 내용에서 사용자가 오래 기억해 둘 가치가 있는 핵심 팩트만 추려 기억 노트로 요약해줘.\n\n"
            ."규칙:\n"
            ."- 인사말·머리말·설명 없이 노트 본문만 출력한다.\n"
            ."- 간결한 팩트 문장 여러 개(최대 5문장)를 한 단락으로 이어 쓴다.\n"
            ."- 전체 {$max}자 이내로 쓴다.\n"
            ."- 원문에 쓰인 언어로 쓴다.\n\n"
            ."[내용]\n".$content;

        try {
            $result = $this->llm->streamChat(
                (string) config('moabom-smart-chat.default_model_id', 'gemini-flash-lite'),
                [['role' => 'user', 'content' => $instruction]],
                static function (): void {},
            );
            $summary = trim($result['content']);
            if ($summary !== '') {
                return $summary;
            }
        } catch (\Throwable $e) {
            Log::warning('moabom-smart-chat.memory_summarize_failed', ['message' => $e->getMessage()]);
        }

        return $content;
    }

    private function autoTitle(string $userText): string
    {
        $oneLine = preg_replace('/\s+/u', ' ', trim($userText)) ?? '';
        if (mb_strlen($oneLine) <= 40) {
            return $oneLine !== '' ? $oneLine : __('moabom-smart-chat::messages.conversation.untitled');
        }

        return mb_substr($oneLine, 0, 40).'…';
    }
}
