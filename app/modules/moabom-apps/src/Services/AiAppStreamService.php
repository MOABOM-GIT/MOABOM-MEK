<?php

namespace Modules\Moabom\Apps\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Modules\Moabom\Apps\Exceptions\AiStreamCancelledException;
use Modules\Moabom\Apps\Models\AiGenerationSession;

/**
 * AI 앱 HTML 스트리밍 생성(SSE) — OpenAI / Anthropic / Google SSE 프록시.
 */
class AiAppStreamService
{
    public function __construct(
        private readonly AiAppService $aiAppService,
        private readonly AiGenerationSessionService $sessionService,
    ) {
    }

    /**
     * @param  array{prompt: string, app_type: string, model_id: string, current_html?: string|null, generation_mode?: string|null, continue?: bool, session_id?: int|null}  $data
     * @param  callable(string, array<string, mixed>): void  $emit  ($event, $payload)
     * @return array<string, mixed>
     */
    public function stream(int $userId, array $data, callable $emit, ?AiGenerationSession $session = null): array
    {
        $provider = (string) config('moabom-apps.ai.provider', 'disabled');
        if ($provider === 'disabled' || $provider === '') {
            $fallback = $this->aiAppService->generate($data);
            $raw = (string) ($fallback['html'] ?? '');
            if ($raw !== '') {
                $emit('delta', ['text' => $raw]);
            }
            if ($session !== null) {
                $this->sessionService->complete($session, array_merge($fallback, ['raw' => $raw]));
                $fallback['session_id'] = $session->id;
            }
            $emit('done', $this->donePayload($fallback, $session));

            return $fallback;
        }

        $model = $this->aiAppService->resolveModelConfig($data['model_id']);
        $resolvedProvider = $provider === 'auto' ? $model['provider'] : $provider;
        $continue = (bool) ($data['continue'] ?? false);
        $mode = (string) ($data['generation_mode'] ?? '');
        $partialRaw = $continue && $session !== null ? (string) ($session->partial_raw ?? '') : '';
        if ($continue && $partialRaw === '') {
            $partialRaw = (string) ($data['current_html'] ?? '');
        }

        $userPrompt = $this->aiAppService->buildStreamUserPrompt($data, $continue, $partialRaw);
        $systemPrompt = $this->aiAppService->systemPromptForType($data['app_type']);

        $streamResult = match ($resolvedProvider) {
            'anthropic' => $this->streamAnthropic($systemPrompt, $userPrompt, $model['model'], $emit),
            'openai' => $this->streamOpenAi($systemPrompt, $userPrompt, $model['model'], $emit),
            'google' => $this->streamGoogle($systemPrompt, $userPrompt, $model['model'], $emit),
            default => ['content' => '', 'truncated' => false, 'finish_reason' => null],
        };

        $mergedContent = $partialRaw !== '' && $continue
            ? $partialRaw.$this->stripRepeatedPrefix($partialRaw, $streamResult['content'])
            : $streamResult['content'];
        if ($mode === 'patch') {
            $mergedContent = $streamResult['content'];
        }

        $result = $this->aiAppService->buildStreamResult(
            $data,
            $mergedContent,
            $resolvedProvider,
            $model['model'],
            $streamResult['truncated'],
            $streamResult['finish_reason'],
        );
        $result['raw'] = $result['raw'] ?? $mergedContent;

        if ($session !== null) {
            $fresh = $this->sessionService->findForUser($userId, $session->id);
            if ($fresh === null) {
                throw new AiStreamCancelledException();
            }

            $messages = $this->appendMessages($session, $data, $mergedContent, $continue);
            $this->sessionService->complete($session, $result, $messages);
            $result['session_id'] = $session->id;
        }

        $emit('done', $this->donePayload($result, $session));

        return $result;
    }

    /**
     * @param  callable(string, array<string, mixed>): void  $emit
     * @return array{content: string, truncated: bool, finish_reason: string|null}
     */
    private function streamOpenAi(string $systemPrompt, string $userPrompt, string $model, callable $emit): array
    {
        $apiKey = (string) config('moabom-apps.ai.openai_api_key', '');
        if ($apiKey === '') {
            return ['content' => '', 'truncated' => false, 'finish_reason' => 'no_key'];
        }

        $response = Http::withToken($apiKey)
            ->withOptions(['stream' => true])
            ->acceptJson()
            ->timeout((int) config('moabom-apps.ai.stream_timeout', 120))
            ->post(
                'https://api.openai.com/v1/chat/completions',
                $this->aiAppService->buildOpenAiChatPayload($model, [
                    ['role' => 'system', 'content' => $systemPrompt],
                    ['role' => 'user', 'content' => $userPrompt],
                ], stream: true)
            );

        if (! $response->successful()) {
            $this->logUpstreamFailure('openai', $model, $response->status(), $response->body());

            return ['content' => '', 'truncated' => false, 'finish_reason' => 'error'];
        }

        return $this->readOpenAiSse($response, $emit);
    }

    /**
     * @param  callable(string, array<string, mixed>): void  $emit
     * @return array{content: string, truncated: bool, finish_reason: string|null}
     */
    private function streamAnthropic(string $systemPrompt, string $userPrompt, string $model, callable $emit): array
    {
        $apiKey = (string) config('moabom-apps.ai.anthropic_api_key', '');
        if ($apiKey === '') {
            return ['content' => '', 'truncated' => false, 'finish_reason' => 'no_key'];
        }

        $response = Http::withHeaders([
            'x-api-key' => $apiKey,
            'anthropic-version' => '2023-06-01',
        ])
            ->withOptions(['stream' => true])
            ->acceptJson()
            ->timeout((int) config('moabom-apps.ai.stream_timeout', 120))
            ->post('https://api.anthropic.com/v1/messages', [
                'model' => $model,
                'stream' => true,
                'system' => $systemPrompt,
                'messages' => [
                    ['role' => 'user', 'content' => $userPrompt],
                ],
                'temperature' => 0.7,
                'max_tokens' => $this->maxOutputTokens(),
            ]);

        if (! $response->successful()) {
            $this->logUpstreamFailure('anthropic', $model, $response->status(), $response->body());

            return ['content' => '', 'truncated' => false, 'finish_reason' => 'error'];
        }

        return $this->readAnthropicSse($response, $emit);
    }

    /**
     * @param  callable(string, array<string, mixed>): void  $emit
     * @return array{content: string, truncated: bool, finish_reason: string|null}
     */
    private function streamGoogle(string $systemPrompt, string $userPrompt, string $model, callable $emit): array
    {
        $apiKey = (string) config('moabom-apps.ai.google_api_key', '');
        if ($apiKey === '') {
            return ['content' => '', 'truncated' => false, 'finish_reason' => 'no_key'];
        }

        $response = Http::withOptions(['stream' => true])
            ->acceptJson()
            ->timeout((int) config('moabom-apps.ai.stream_timeout', 120))
            ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:streamGenerateContent?alt=sse&key={$apiKey}", [
                'systemInstruction' => [
                    'parts' => [
                        ['text' => $systemPrompt],
                    ],
                ],
                'contents' => [
                    [
                        'role' => 'user',
                        'parts' => [
                            ['text' => $userPrompt],
                        ],
                    ],
                ],
                'generationConfig' => [
                    'temperature' => 0.7,
                    'maxOutputTokens' => $this->maxOutputTokens(),
                ],
            ]);

        if (! $response->successful()) {
            $this->logUpstreamFailure('google', $model, $response->status(), $response->body());

            return ['content' => '', 'truncated' => false, 'finish_reason' => 'error'];
        }

        return $this->readGoogleSse($response, $emit);
    }

    /**
     * @param  callable(string, array<string, mixed>): void  $emit
     * @return array{content: string, truncated: bool, finish_reason: string|null}
     */
    private function readOpenAiSse(\Illuminate\Http\Client\Response $response, callable $emit): array
    {
        $body = $response->toPsrResponse()->getBody();
        $buffer = '';
        $content = '';
        $finishReason = null;

        while (! $body->eof()) {
            if (connection_aborted()) {
                throw new AiStreamCancelledException();
            }

            $buffer .= $body->read(2048);
            while (($pos = strpos($buffer, "\n")) !== false) {
                $line = trim(substr($buffer, 0, $pos));
                $buffer = substr($buffer, $pos + 1);

                if (! str_starts_with($line, 'data:')) {
                    continue;
                }

                $json = trim(substr($line, 5));
                if ($json === '' || $json === '[DONE]') {
                    continue;
                }

                $chunk = json_decode($json, true);
                if (! is_array($chunk)) {
                    continue;
                }

                $delta = (string) data_get($chunk, 'choices.0.delta.content', '');
                if ($delta !== '') {
                    $content .= $delta;
                    $emit('delta', ['text' => $delta]);
                }

                $reason = data_get($chunk, 'choices.0.finish_reason');
                if (is_string($reason) && $reason !== '') {
                    $finishReason = $reason;
                }
            }
        }

        return [
            'content' => $content,
            'truncated' => $finishReason === 'length',
            'finish_reason' => $finishReason,
        ];
    }

    /**
     * @param  callable(string, array<string, mixed>): void  $emit
     * @return array{content: string, truncated: bool, finish_reason: string|null}
     */
    private function readAnthropicSse(\Illuminate\Http\Client\Response $response, callable $emit): array
    {
        $body = $response->toPsrResponse()->getBody();
        $buffer = '';
        $content = '';
        $finishReason = null;

        while (! $body->eof()) {
            if (connection_aborted()) {
                throw new AiStreamCancelledException();
            }

            $buffer .= $body->read(2048);
            while (($pos = strpos($buffer, "\n")) !== false) {
                $line = trim(substr($buffer, 0, $pos));
                $buffer = substr($buffer, $pos + 1);

                if ($line === '' || ! str_starts_with($line, 'data:')) {
                    continue;
                }

                $chunk = json_decode(trim(substr($line, 5)), true);
                if (! is_array($chunk)) {
                    continue;
                }

                $type = (string) ($chunk['type'] ?? '');
                if ($type === 'content_block_delta') {
                    $delta = (string) data_get($chunk, 'delta.text', '');
                    if ($delta !== '') {
                        $content .= $delta;
                        $emit('delta', ['text' => $delta]);
                    }
                }

                if ($type === 'message_delta') {
                    $finishReason = data_get($chunk, 'delta.stop_reason') ?? data_get($chunk, 'delta.stop_reason');
                }
            }
        }

        return [
            'content' => $content,
            'truncated' => $finishReason === 'max_tokens',
            'finish_reason' => is_string($finishReason) ? $finishReason : null,
        ];
    }

    /**
     * @param  callable(string, array<string, mixed>): void  $emit
     * @return array{content: string, truncated: bool, finish_reason: string|null}
     */
    private function readGoogleSse(\Illuminate\Http\Client\Response $response, callable $emit): array
    {
        $body = $response->toPsrResponse()->getBody();
        $buffer = '';
        $content = '';
        $finishReason = null;

        while (! $body->eof()) {
            if (connection_aborted()) {
                throw new AiStreamCancelledException();
            }

            $buffer .= $body->read(2048);
            while (($pos = strpos($buffer, "\n")) !== false) {
                $line = trim(substr($buffer, 0, $pos));
                $buffer = substr($buffer, $pos + 1);

                if ($line === '' || ! str_starts_with($line, 'data:')) {
                    continue;
                }

                $chunk = json_decode(trim(substr($line, 5)), true);
                if (! is_array($chunk)) {
                    continue;
                }

                $delta = collect(data_get($chunk, 'candidates.0.content.parts', []))
                    ->pluck('text')
                    ->implode('');
                if ($delta !== '') {
                    $content .= $delta;
                    $emit('delta', ['text' => $delta]);
                }

                $reason = data_get($chunk, 'candidates.0.finishReason');
                if (is_string($reason) && $reason !== '') {
                    $finishReason = $reason;
                }
            }
        }

        return [
            'content' => $content,
            'truncated' => in_array($finishReason, ['MAX_TOKENS', 'LENGTH'], true),
            'finish_reason' => is_string($finishReason) ? $finishReason : null,
        ];
    }

    /**
     * @param  array{prompt: string}  $data
     * @return array<int, array<string, mixed>>
     */
    private function appendMessages(AiGenerationSession $session, array $data, string $assistantContent, bool $continue): array
    {
        $messages = is_array($session->messages) ? $session->messages : [];

        if (! $continue) {
            $messages[] = [
                'role' => 'user',
                'content' => $data['prompt'],
                'at' => now()->toISOString(),
            ];
        } else {
            $messages[] = [
                'role' => 'user',
                'content' => $data['prompt'] !== ''
                    ? $data['prompt']
                    : __('moabom-apps::messages.apps.ai.continue_default_prompt'),
                'at' => now()->toISOString(),
                'continue' => true,
                'generation_mode' => $data['generation_mode'] ?? null,
            ];
        }

        $messages[] = [
            'role' => 'assistant',
            'content' => $assistantContent,
            'at' => now()->toISOString(),
        ];

        return $messages;
    }

    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function donePayload(array $result, ?AiGenerationSession $session): array
    {
        return [
            'html' => (string) ($result['html'] ?? ''),
            'model_id' => (string) ($result['model_id'] ?? ''),
            'provider' => (string) ($result['provider'] ?? ''),
            'fallback' => (bool) ($result['fallback'] ?? false),
            'notice' => $result['notice'] ?? null,
            'truncated' => (bool) ($result['truncated'] ?? false),
            'finish_reason' => $result['finish_reason'] ?? null,
            'session_id' => $session?->id ?? ($result['session_id'] ?? null),
        ];
    }

    private function maxOutputTokens(): int
    {
        return max(1024, min(65536, (int) config('moabom-apps.ai.max_output_tokens', 30000)));
    }

    private function logUpstreamFailure(string $provider, string $model, int $status, string $body): void
    {
        Log::warning('moabom_apps_ai_upstream_failed', [
            'provider' => $provider,
            'model' => $model,
            'status' => $status,
            'body_excerpt' => mb_substr($body, 0, 600),
        ]);
    }

    private function stripRepeatedPrefix(string $base, string $suffix): string
    {
        $trimmed = ltrim($suffix);
        if ($trimmed === '') {
            return $suffix;
        }

        if (str_starts_with($trimmed, '<!DOCTYPE html>') || str_starts_with($trimmed, '<html')) {
            $needle = $this->tailContext($base, 2000);
            $pos = $needle !== '' ? strpos($trimmed, $needle) : false;
            if ($pos !== false) {
                return substr($trimmed, $pos + strlen($needle));
            }
        }

        $max = min(strlen($base), strlen($suffix), 2000);
        for ($length = $max; $length >= 80; $length -= 40) {
            if (substr($base, -$length) === substr($suffix, 0, $length)) {
                return substr($suffix, $length);
            }
        }

        return $suffix;
    }

    private function tailContext(string $value, int $bytes): string
    {
        if (strlen($value) <= $bytes) {
            return $value;
        }

        return substr($value, -$bytes);
    }
}
