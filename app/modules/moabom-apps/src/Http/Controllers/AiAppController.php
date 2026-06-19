<?php

namespace Modules\Moabom\Apps\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Modules\Moabom\Apps\Exceptions\AiStreamCancelledException;
use Modules\Moabom\Apps\Http\Requests\GenerateAiAppRequest;
use Modules\Moabom\Apps\Http\Requests\ShareGeneratedAppRequest;
use Modules\Moabom\Apps\Http\Requests\StoreGeneratedAppRequest;
use Modules\Moabom\Apps\Http\Requests\StreamAiAppRequest;
use Modules\Moabom\Apps\Services\AiAppService;
use Modules\Moabom\Apps\Services\AiAppStreamService;
use Modules\Moabom\Apps\Services\AiGenerationSessionService;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AiAppController extends AuthBaseController
{
    public function __construct(
        private readonly AiAppService $aiAppService,
        private readonly AiAppStreamService $aiAppStreamService,
        private readonly AiGenerationSessionService $sessionService,
    ) {
        parent::__construct();
    }

    /**
     * AI 앱 HTML을 생성합니다.
     */
    public function generate(GenerateAiAppRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $result = $this->aiAppService->generate($request->validated());

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.ai.generate_success',
            $result
        );
    }

    /**
     * AI 앱 HTML을 SSE 스트리밍으로 생성합니다.
     */
    public function stream(StreamAiAppRequest $request): StreamedResponse|JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $validated = $request->validated();
        $generatedAppId = (int) ($validated['generated_app_id'] ?? 0);
        if ($generatedAppId > 0 && $this->aiAppService->findForUser($user->id, $generatedAppId) === null) {
            unset($validated['generated_app_id']);
        }
        $continue = (bool) ($validated['continue'] ?? false);
        $sessionId = isset($validated['session_id']) ? (int) $validated['session_id'] : null;

        if ($continue) {
            $session = $sessionId !== null
                ? $this->sessionService->findForUser($user->id, $sessionId)
                : $this->sessionService->findActiveForUser($user->id);
            if ($session === null) {
                return ResponseHelper::moduleError(
                    'moabom-apps',
                    'messages.apps.ai.session_not_found',
                    404,
                );
            }
            $session = $this->sessionService->begin($user->id, $validated, $session->id);
        } else {
            $session = $this->sessionService->begin($user->id, $validated, $sessionId);
        }

        $userId = $user->id;
        $buffer = $continue
            ? ((string) ($session->partial_raw ?? '') ?: (string) ($validated['current_html'] ?? ''))
            : '';
        $lastPersistAt = 0;
        $streamService = $this->aiAppStreamService;
        $sessionService = $this->sessionService;

        return response()->stream(function () use ($validated, $userId, $session, &$buffer, &$lastPersistAt, $streamService, $sessionService): void {
            $emit = function (string $event, array $payload) use (&$buffer, &$lastPersistAt, $session, $sessionService): void {
                if (connection_aborted()) {
                    throw new AiStreamCancelledException();
                }

                if ($event === 'delta') {
                    $buffer .= (string) ($payload['text'] ?? '');
                    $now = microtime(true);
                    if ($now - $lastPersistAt >= 1.5) {
                        if ($sessionService->findForUser($session->user_id, $session->id) !== null) {
                            $sessionService->persistProgress($session, $buffer);
                        }
                        $lastPersistAt = $now;
                    }
                }

                echo 'event: '.$event."\n";
                echo 'data: '.json_encode($payload, JSON_UNESCAPED_UNICODE)."\n\n";

                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();

                if (connection_aborted()) {
                    throw new AiStreamCancelledException();
                }
            };

            try {
                $emit('session', ['session_id' => $session->id]);
                $streamService->stream($userId, $validated, $emit, $session);
            } catch (AiStreamCancelledException) {
                $sessionService->cancelForUser($userId, $session->id);
            } catch (\Throwable $e) {
                if ($sessionService->findForUser($userId, $session->id) !== null) {
                    $sessionService->pause($session, $buffer);
                }
                $emit('error', ['message' => $e->getMessage()]);
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-transform',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * 생성 앱 목록을 조회합니다.
     */
    public function index(): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.fetch_success',
            [
                'items' => $this->aiAppService->listForUser($user->id),
            ]
        );
    }

    /**
     * 공유 공개된 생성 앱 목록을 조회합니다.
     */
    public function shared(): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.fetch_success',
            [
                'items' => $this->aiAppService->listShared(viewerUserId: $user->id),
            ]
        );
    }

    /**
     * 생성 앱 단건을 조회합니다 (HTML 포함).
     */
    public function show(int $id): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $app = $this->aiAppService->findVisibleForUser($user->id, $id);
        if (! $app) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.not_found',
                404
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.show_success',
            $this->aiAppService->serialize($app, viewerUserId: $user->id)
        );
    }

    /**
     * 생성 앱 공유 상태를 토글합니다.
     */
    public function share(ShareGeneratedAppRequest $request, int $id): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $app = $this->aiAppService->setSharedForUser(
            $user->id,
            $id,
            (bool) $request->validated('is_shared')
        );
        if ($app === null) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.not_found',
                404
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.share_success',
            $this->aiAppService->serialize($app, viewerUserId: $user->id)
        );
    }

    /**
     * 생성 앱을 저장합니다.
     */
    public function store(StoreGeneratedAppRequest $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $app = $this->aiAppService->store($user->id, $request->validated());
        $sessionId = (int) data_get($request->validated(), 'metadata.ai_generation_session_id', 0);
        if ($sessionId > 0) {
            $session = $this->sessionService->findForUser($user->id, $sessionId);
            if ($session !== null) {
                $this->sessionService->linkGeneratedApp($session, $app->id);
            }
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.save_success',
            $this->aiAppService->serialize($app, viewerUserId: $user->id),
            201
        );
    }

    /**
     * 생성 앱을 수정합니다.
     */
    public function update(StoreGeneratedAppRequest $request, int $id): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $app = $this->aiAppService->updateForUser($user->id, $id, $request->validated());
        if ($app === null) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.not_found',
                404
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.update_success',
            $this->aiAppService->serialize($app, viewerUserId: $user->id)
        );
    }

    /**
     * 생성 앱과 연결된 생성 세션을 영구 삭제합니다.
     */
    public function destroy(int $id): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $deleted = DB::transaction(function () use ($user, $id): bool {
            $this->sessionService->deleteForGeneratedApp($user->id, $id);

            return $this->aiAppService->deleteForUser($user->id, $id);
        });

        if (! $deleted) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.generated.not_found',
                404
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.delete_success',
            ['id' => $id]
        );
    }
}
