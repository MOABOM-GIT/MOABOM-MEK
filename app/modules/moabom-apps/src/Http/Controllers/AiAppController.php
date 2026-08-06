<?php

namespace Modules\Moabom\Apps\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\Moabom\Apps\Exceptions\AiStreamCancelledException;
use Modules\Moabom\Apps\Http\Requests\GenerateAiAppRequest;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;
use Modules\Moabom\Apps\Http\Requests\ShareGeneratedAppRequest;
use Modules\Moabom\Apps\Http\Requests\StoreGeneratedAppRequest;
use Modules\Moabom\Apps\Http\Requests\StreamAiAppRequest;
use Modules\Moabom\Apps\Services\AiAppService;
use Modules\Moabom\Apps\Services\AiAppStreamService;
use Modules\Moabom\Apps\Services\AiGenerationSessionService;
use Modules\Moabom\Apps\Services\AiStreamConcurrencyService;
use Modules\Moabom\Apps\Services\CreateAppCreditGate;
use Modules\Moabom\Apps\Services\MoabomShellHomeAppOrderPruner;
use Modules\Moabom\Apps\Support\AiStreamGateResult;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AiAppController extends AuthBaseController
{
    public function __construct(
        private readonly AiAppService $aiAppService,
        private readonly AiAppStreamService $aiAppStreamService,
        private readonly AiGenerationSessionService $sessionService,
        private readonly AiStreamConcurrencyService $concurrency,
        private readonly CreateAppCreditGate $createAppCreditGate,
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

        $gate = $this->concurrency->requestAccess(
            $user->id,
            isset($validated['lease_token']) ? (string) $validated['lease_token'] : null,
            isset($validated['queue_ticket']) ? (string) $validated['queue_ticket'] : null,
        );

        if ($gate->status === AiStreamGateResult::STATUS_DENIED) {
            $messageKey = $gate->reason === 'queue_full'
                ? 'messages.apps.ai.queue_full'
                : 'messages.apps.ai.queue_denied';

            return ResponseHelper::moduleError(
                'moabom-apps',
                $messageKey,
                503,
            );
        }

        if ($gate->status === AiStreamGateResult::STATUS_QUEUED) {
            $response = ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.ai.queue_waiting',
                429,
                $gate->toQueuePayload(),
                [
                    'position' => $gate->queuePosition,
                    'minutes' => max(1, (int) ceil($gate->estimatedWaitSeconds / 60)),
                ],
            );

            return $response->header('Retry-After', (string) $gate->retryAfterSeconds);
        }

        $continue = (bool) ($validated['continue'] ?? false);
        if (! $continue) {
            try {
                $this->createAppCreditGate->preflight($user);
            } catch (\InvalidArgumentException $e) {
                return ResponseHelper::moduleError(
                    'moabom-apps',
                    'messages.apps.ai.credit.insufficient',
                    422,
                );
            }
        }

        $leaseToken = (string) $gate->leaseToken;
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
        $creditGate = $this->createAppCreditGate;
        $shouldSettleCredit = ! $continue;
        $buffer = $continue
            ? ((string) ($session->partial_raw ?? '') ?: (string) ($validated['current_html'] ?? ''))
            : '';
        $lastPersistAt = 0;
        $streamService = $this->aiAppStreamService;
        $sessionService = $this->sessionService;
        $concurrency = $this->concurrency;

        return response()->stream(function () use ($validated, $userId, $user, $session, &$buffer, &$lastPersistAt, $streamService, $sessionService, $concurrency, $leaseToken, $creditGate, $shouldSettleCredit): void {
            $released = false;
            $releaseLease = static function () use ($concurrency, $leaseToken, &$released): void {
                if ($released || $leaseToken === '') {
                    return;
                }
                $released = true;
                $concurrency->releaseLease($leaseToken);
            };

            register_shutdown_function(static function () use ($releaseLease): void {
                $releaseLease();
            });

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
                if ($shouldSettleCredit) {
                    try {
                        $creditGate->settle($user, (string) $session->id, [
                            'model_id' => $validated['model_id'] ?? null,
                            'app_type' => $validated['app_type'] ?? null,
                        ]);
                    } catch (\Throwable) {
                        // settle 실패해도 생성 결과는 유지
                    }
                }
            } catch (AiStreamCancelledException) {
                // 클라이언트가 cancel API로 이미 지운 경우는 스킵.
                // 네트워크 끊김 등 abort만 온 경우 partial을 pause 해 이어하기를 살린다.
                if ($sessionService->findForUser($userId, $session->id) !== null) {
                    if (trim($buffer) !== '') {
                        $sessionService->pause($session, $buffer);
                    } else {
                        $sessionService->cancelForUser($userId, $session->id);
                    }
                }
            } catch (\Throwable $e) {
                if ($sessionService->findForUser($userId, $session->id) !== null) {
                    $sessionService->pause($session, $buffer);
                }
                $emit('error', ['message' => $e->getMessage()]);
            } finally {
                $releaseLease();
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-transform',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * 홈 셸 라이브러리 — owned·published 목록을 1회에 조회합니다.
     */
    public function library(): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.fetch_success',
            $this->aiAppService->libraryForUser($user->id),
        );
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
     * 생성 앱 단건을 조회합니다.
     *
     * `include_html=0` 이면 메타·preview_url 만 반환(실행/권한용).
     * 기본·`include_html=1` 은 HTML 포함(편집·리믹스용). iframe 본문은 preview_url.
     */
    public function show(Request $request, int $id): JsonResponse
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

        $includeHtml = $request->boolean('include_html', true);

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.show_success',
            $this->aiAppService->serialize($app, includeHtml: $includeHtml, viewerUserId: $user->id)
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

        $validated = $request->validated();
        $visibility = isset($validated['visibility'])
            ? GeneratedAppVisibility::from((string) $validated['visibility'])
            : (($validated['is_shared'] ?? false)
                ? GeneratedAppVisibility::Tenant
                : GeneratedAppVisibility::Private);

        $app = $this->aiAppService->setVisibilityForUser(
            $user->id,
            $id,
            $visibility,
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

        try {
            app(MoabomShellHomeAppOrderPruner::class)->pruneForUser((int) $user->id, $id);
        } catch (\Throwable) {
            // settings prune 실패해도 앱 삭제는 성공 — 프론트 reconcile 이 후속 정리
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.generated.delete_success',
            ['id' => $id]
        );
    }
}
