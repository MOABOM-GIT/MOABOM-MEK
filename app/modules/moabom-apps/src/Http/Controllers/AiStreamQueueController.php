<?php

namespace Modules\Moabom\Apps\Http\Controllers;

use App\Helpers\ResponseHelper;
use App\Http\Controllers\Api\Base\AuthBaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Moabom\Apps\Services\AiStreamConcurrencyService;
use Modules\Moabom\Apps\Support\AiStreamGateResult;

class AiStreamQueueController extends AuthBaseController
{
    public function __construct(
        private readonly AiStreamConcurrencyService $concurrency,
    ) {
        parent::__construct();
    }

    public function show(Request $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $ticketId = trim((string) $request->query('ticket', ''));
        if ($ticketId === '') {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.ai.queue_ticket_required',
                422,
            );
        }

        $status = $this->concurrency->getQueueStatus($user->id, $ticketId);
        if ($status === null) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.ai.queue_ticket_not_found',
                404,
            );
        }

        $messageKey = $status->status === AiStreamGateResult::STATUS_READY
            ? 'messages.apps.ai.queue_ready'
            : 'messages.apps.ai.queue_waiting';

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            $messageKey,
            [
                'queue' => $status->toStatusPayload(),
            ],
            messageParams: [
                'position' => $status->queuePosition,
                'minutes' => max(1, (int) ceil($status->estimatedWaitSeconds / 60)),
            ],
        );
    }

    public function destroy(Request $request): JsonResponse
    {
        $user = $this->getCurrentUser();
        if (! $user) {
            return $this->unauthorized('auth.unauthenticated');
        }

        $ticketId = trim((string) $request->input('ticket', $request->query('ticket', '')));
        if ($ticketId === '') {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.ai.queue_ticket_required',
                422,
            );
        }

        if (! $this->concurrency->cancelTicket($user->id, $ticketId)) {
            return ResponseHelper::moduleError(
                'moabom-apps',
                'messages.apps.ai.queue_ticket_not_found',
                404,
            );
        }

        return ResponseHelper::moduleSuccess(
            'moabom-apps',
            'messages.apps.ai.queue_cancel_success',
            ['ticket_id' => $ticketId],
        );
    }
}
