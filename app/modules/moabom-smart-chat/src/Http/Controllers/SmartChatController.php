<?php

namespace Modules\Moabom\Smart\Chat\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use Modules\Moabom\Smart\Chat\Http\Requests\HandoffPromptRequest;
use Modules\Moabom\Smart\Chat\Http\Requests\StoreConversationRequest;
use Modules\Moabom\Smart\Chat\Http\Requests\StoreFolderRequest;
use Modules\Moabom\Smart\Chat\Http\Requests\StoreMemoryRequest;
use Modules\Moabom\Smart\Chat\Http\Requests\StorePreferencesRequest;
use Modules\Moabom\Smart\Chat\Http\Requests\StreamMessageRequest;
use Modules\Moabom\Smart\Chat\Http\Requests\UpdateConversationRequest;
use Modules\Moabom\Smart\Chat\Http\Requests\UploadAttachmentRequest;
use Modules\Moabom\Smart\Chat\Services\SmartChatAttachmentService;
use Modules\Moabom\Smart\Chat\Services\SmartChatFolderService;
use Modules\Moabom\Smart\Chat\Services\SmartChatGeneratedAppContextService;
use Modules\Moabom\Smart\Chat\Services\SmartChatLlmService;
use Modules\Moabom\Smart\Chat\Services\SmartChatMemoryService;
use Modules\Moabom\Smart\Chat\Services\SmartChatPreferenceService;
use Modules\Moabom\Smart\Chat\Services\SmartChatService;
use Modules\Moabom\Smart\Chat\Services\SmartChatShareService;
use Modules\Moabom\Smart\Chat\Services\SmartChatToolRegistry;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SmartChatController extends AuthBaseController
{
    public function __construct(
        private readonly SmartChatService $chatService,
        private readonly SmartChatLlmService $llmService,
        private readonly SmartChatAttachmentService $attachmentService,
        private readonly SmartChatPreferenceService $preferenceService,
        private readonly SmartChatToolRegistry $toolRegistry,
        private readonly SmartChatGeneratedAppContextService $generatedAppContext,
        private readonly SmartChatFolderService $folderService,
        private readonly SmartChatMemoryService $memoryService,
        private readonly SmartChatShareService $shareService,
    ) {
        parent::__construct();
    }

    /**
     * "이 답으로 앱 만들기" — 질문+답변을 앱 제작 프롬프트로 요약해 반환.
     */
    public function handoffPrompt(HandoffPromptRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $handoff = $this->chatService->buildAppHandoffPrompt(
            (string) ($request->validated('question') ?? ''),
            (string) $request->validated('answer'),
        );

        return ResponseHelper::moduleSuccess(
            'moabom-smart-chat',
            'messages.handoff.create_success',
            [
                'title' => $handoff['title'],
                'prompt' => $handoff['prompt'],
            ],
        );
    }

    public function models(): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        return ResponseHelper::moduleSuccess(
            'moabom-smart-chat',
            'messages.models.fetch_success',
            [
                'models' => $this->llmService->listModels(),
                'default_model_id' => config('moabom-smart-chat.default_model_id'),
            ]
        );
    }

    public function preferences(): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        return ResponseHelper::moduleSuccess(
            'moabom-smart-chat',
            'messages.preferences.fetch_success',
            $this->preferenceService->getAll($user)
        );
    }

    public function storePreferences(StorePreferencesRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $saved = $this->preferenceService->save($user, $request->validated());

        return ResponseHelper::moduleSuccess(
            'moabom-smart-chat',
            'messages.preferences.save_success',
            $saved
        );
    }

    public function tools(): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        return ResponseHelper::moduleSuccess(
            'moabom-smart-chat',
            'messages.tools.fetch_success',
            $this->toolRegistry->catalog()
        );
    }

    public function generatedApps(): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        return ResponseHelper::moduleSuccess(
            'moabom-smart-chat',
            'messages.generated_apps.fetch_success',
            ['apps' => $this->generatedAppContext->listForPicker($user)]
        );
    }

    public function indexFolders(): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        return ResponseHelper::moduleSuccess(
            'moabom-smart-chat',
            'messages.folders.fetch_success',
            ['folders' => $this->folderService->list($user)]
        );
    }

    public function storeFolder(StoreFolderRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        try {
            $folder = $this->folderService->create($user, (string) $request->validated('name'));
        } catch (InvalidArgumentException $e) {
            $key = str_starts_with($e->getMessage(), 'messages.') ? $e->getMessage() : 'messages.folders.limit';

            return ResponseHelper::moduleError('moabom-smart-chat', $key, 422);
        }

        return ResponseHelper::moduleSuccess(
            'moabom-smart-chat',
            'messages.folders.create_success',
            ['folder' => $this->folderService->serialize($folder)]
        );
    }

    public function updateFolder(string $uuid, StoreFolderRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $folder = $this->folderService->findOwned($user, $uuid);
        if ($folder === null) {
            return ResponseHelper::moduleError('moabom-smart-chat', 'messages.folders.not_found', 404);
        }

        try {
            $folder = $this->folderService->rename($folder, (string) $request->validated('name'));
        } catch (InvalidArgumentException $e) {
            return ResponseHelper::moduleError('moabom-smart-chat', $e->getMessage(), 422);
        }

        return ResponseHelper::moduleSuccess(
            'moabom-smart-chat',
            'messages.folders.update_success',
            ['folder' => $this->folderService->serialize($folder)]
        );
    }

    public function destroyFolder(string $uuid): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $folder = $this->folderService->findOwned($user, $uuid);
        if ($folder === null) {
            return ResponseHelper::moduleError('moabom-smart-chat', 'messages.folders.not_found', 404);
        }

        $this->folderService->delete($folder);

        return ResponseHelper::moduleSuccess('moabom-smart-chat', 'messages.folders.delete_success', []);
    }

    public function indexMemories(): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        return ResponseHelper::moduleSuccess(
            'moabom-smart-chat',
            'messages.memory.fetch_success',
            ['memories' => $this->memoryService->list($user)]
        );
    }

    public function storeMemory(StoreMemoryRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $conversation = null;
        $convUuid = $request->validated('conversation_uuid');
        if (is_string($convUuid) && $convUuid !== '') {
            $conversation = $this->chatService->findOwned($user, $convUuid);
        }

        // "기억하기" — 짧은 내용은 그대로, 긴 내용은 핵심 팩트만 LLM 요약 후 저장
        $content = (string) $request->validated('content');
        if ($request->boolean('summarize') && mb_strlen($content) > 200) {
            $content = $this->chatService->summarizeMemoryFacts($content);
        }

        try {
            $memory = $this->memoryService->add($user, $content, $conversation);
        } catch (InvalidArgumentException $e) {
            return ResponseHelper::moduleError('moabom-smart-chat', $e->getMessage(), 422);
        }

        return ResponseHelper::moduleSuccess(
            'moabom-smart-chat',
            'messages.memory.create_success',
            ['memory' => $this->memoryService->serialize($memory)]
        );
    }

    public function destroyMemory(string $uuid): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $memory = $this->memoryService->findOwned($user, $uuid);
        if ($memory === null) {
            return ResponseHelper::moduleError('moabom-smart-chat', 'messages.memory.not_found', 404);
        }

        $this->memoryService->delete($memory);

        return ResponseHelper::moduleSuccess('moabom-smart-chat', 'messages.memory.delete_success', []);
    }

    public function uploadAttachment(UploadAttachmentRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $conversationId = null;
        $convUuid = $request->validated('conversation_uuid');
        if (is_string($convUuid) && $convUuid !== '') {
            $conversation = $this->chatService->findOwned($user, $convUuid);
            $conversationId = $conversation?->id;
        }

        try {
            $attachment = $this->attachmentService->upload(
                $user,
                $request->file('file'),
                $conversationId
            );
        } catch (InvalidArgumentException $e) {
            $key = $e->getMessage();
            if (! str_starts_with($key, 'messages.')) {
                $key = 'messages.attachment.upload_failed';
            }

            return ResponseHelper::moduleError('moabom-smart-chat', $key, 422);
        }

        return ResponseHelper::moduleSuccess(
            'moabom-smart-chat',
            'messages.attachment.upload_success',
            ['attachment' => $this->attachmentService->serialize($attachment)]
        );
    }

    public function indexConversations(Request $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $limit = (int) $request->query('limit', 50);
        $folderUuid = $request->query('folder_uuid');
        $folderUuid = is_string($folderUuid) ? $folderUuid : null;

        return ResponseHelper::moduleSuccess(
            'moabom-smart-chat',
            'messages.conversations.fetch_success',
            ['conversations' => $this->chatService->listConversations($user, $limit, $folderUuid)]
        );
    }

    public function storeConversation(StoreConversationRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        try {
            $conversation = $this->chatService->createConversation(
                $user,
                $request->validated('model_id'),
                $request->validated('folder_uuid')
            );
        } catch (InvalidArgumentException $e) {
            return ResponseHelper::moduleError('moabom-smart-chat', $e->getMessage(), 422);
        }

        return ResponseHelper::moduleSuccess(
            'moabom-smart-chat',
            'messages.conversations.create_success',
            ['conversation' => $this->chatService->serializeConversation($conversation)]
        );
    }

    public function updateConversation(string $uuid, UpdateConversationRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $conversation = $this->chatService->findOwned($user, $uuid);
        if ($conversation === null) {
            return ResponseHelper::moduleError('moabom-smart-chat', 'messages.conversations.not_found', 404);
        }

        $validated = $request->validated();
        if (array_key_exists('folder_uuid', $validated)) {
            try {
                $conversation = $this->chatService->moveConversation(
                    $conversation,
                    $user,
                    $validated['folder_uuid']
                );
            } catch (InvalidArgumentException $e) {
                return ResponseHelper::moduleError('moabom-smart-chat', $e->getMessage(), 422);
            }
        }
        if (array_key_exists('title', $validated) && is_string($validated['title'])) {
            $title = trim($validated['title']);
            $conversation->title = $title !== '' ? mb_substr($title, 0, 200) : $conversation->title;
            $conversation->save();
        }

        return ResponseHelper::moduleSuccess(
            'moabom-smart-chat',
            'messages.conversations.update_success',
            ['conversation' => $this->chatService->serializeConversation($conversation->fresh(['folder']))]
        );
    }

    public function enableShare(string $uuid): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $conversation = $this->chatService->findOwned($user, $uuid);
        if ($conversation === null) {
            return ResponseHelper::moduleError('moabom-smart-chat', 'messages.conversations.not_found', 404);
        }

        return ResponseHelper::moduleSuccess(
            'moabom-smart-chat',
            'messages.share.enable_success',
            ['share' => $this->shareService->enable($conversation)]
        );
    }

    public function disableShare(string $uuid): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $conversation = $this->chatService->findOwned($user, $uuid);
        if ($conversation === null) {
            return ResponseHelper::moduleError('moabom-smart-chat', 'messages.conversations.not_found', 404);
        }

        $this->shareService->disable($conversation);

        return ResponseHelper::moduleSuccess('moabom-smart-chat', 'messages.share.disable_success', []);
    }

    public function destroyConversation(string $uuid): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $conversation = $this->chatService->findOwned($user, $uuid);
        if ($conversation === null) {
            return ResponseHelper::moduleError('moabom-smart-chat', 'messages.conversations.not_found', 404);
        }

        $this->chatService->deleteConversation($conversation);

        return ResponseHelper::moduleSuccess(
            'moabom-smart-chat',
            'messages.conversations.delete_success',
            []
        );
    }

    public function indexMessages(string $uuid, Request $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $conversation = $this->chatService->findOwned($user, $uuid);
        if ($conversation === null) {
            return ResponseHelper::moduleError('moabom-smart-chat', 'messages.conversations.not_found', 404);
        }

        $limit = (int) $request->query('limit', 100);

        return ResponseHelper::moduleSuccess(
            'moabom-smart-chat',
            'messages.messages.fetch_success',
            [
                'conversation' => $this->chatService->serializeConversation($conversation),
                'messages' => $this->chatService->listMessages($conversation, $limit),
            ]
        );
    }

    public function streamMessage(string $uuid, StreamMessageRequest $request): StreamedResponse|JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return ResponseHelper::unauthorized('auth.unauthenticated');
        }

        $conversation = $this->chatService->findOwned($user, $uuid);
        if ($conversation === null) {
            return ResponseHelper::moduleError('moabom-smart-chat', 'messages.conversations.not_found', 404);
        }

        $validated = $request->validated();
        $attachmentUuids = array_values(array_filter(
            (array) ($validated['attachment_uuids'] ?? []),
            fn ($v) => is_string($v) && $v !== ''
        ));
        $tools = array_key_exists('tools', $validated)
            ? array_values(array_filter(
                (array) $validated['tools'],
                fn ($v) => is_string($v) && $v !== ''
            ))
            : null;
        $parentId = isset($validated['parent_id']) ? (int) $validated['parent_id'] : null;
        $generatedAppId = isset($validated['generated_app_id']) ? (int) $validated['generated_app_id'] : null;
        $webSearch = (bool) ($validated['web_search'] ?? false);

        return new StreamedResponse(function () use (
            $user,
            $conversation,
            $validated,
            $attachmentUuids,
            $tools,
            $parentId,
            $generatedAppId,
            $webSearch
        ): void {
            $emit = function (string $event, array $payload): void {
                echo 'event: '.$event."\n";
                echo 'data: '.json_encode($payload, JSON_UNESCAPED_UNICODE)."\n\n";
                if (function_exists('ob_flush')) {
                    @ob_flush();
                }
                @flush();
            };

            try {
                $this->chatService->streamTurn(
                    $user,
                    $conversation,
                    (string) ($validated['content'] ?? ''),
                    isset($validated['model_id']) ? (string) $validated['model_id'] : null,
                    $attachmentUuids,
                    $emit,
                    $parentId,
                    $generatedAppId,
                    $tools,
                    $webSearch
                );
            } catch (InvalidArgumentException $e) {
                $msg = $e->getMessage();
                if (str_starts_with($msg, 'messages.')) {
                    $msg = (string) __('moabom-smart-chat::'.$msg);
                }
                $emit('error', ['message' => $msg, 'code' => 'validation']);
            } catch (\RuntimeException $e) {
                $msg = $e->getMessage();
                if (str_starts_with($msg, 'messages.')) {
                    $msg = (string) __('moabom-smart-chat::'.$msg);
                }
                $emit('error', ['message' => $msg, 'code' => 'busy']);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::error('moabom-smart-chat.stream_failed', [
                    'user_id' => $user->id,
                    'conversation' => $conversation->uuid,
                    'exception' => get_class($e),
                    'message' => $e->getMessage(),
                    'at' => $e->getFile().':'.$e->getLine(),
                ]);
                $msg = $e->getMessage();
                if (str_starts_with($msg, 'messages.')) {
                    $msg = (string) __('moabom-smart-chat::'.$msg);
                } else {
                    $msg = (string) __('moabom-smart-chat::messages.llm.upstream_failed');
                }
                $emit('error', ['message' => $msg, 'code' => 'failed']);
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-transform',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}