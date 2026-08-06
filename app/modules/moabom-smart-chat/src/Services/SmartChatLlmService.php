<?php

namespace Modules\Moabom\Smart\Chat\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * 멀티턴 채팅 LLM 스트림 — moabom-apps.ai 키·모델 맵 재사용, create-app HTML 프롬프트와 분리.
 *
 * Function calling(도구 호출) 루프 지원 (pull 방식):
 * 데이터를 미리 주입하지 않고 도구 스펙만 선언 → LLM 이 필요할 때 호출 →
 * 백엔드 실행 결과를 돌려주면 이어서 최종 답변을 스트림한다.
 * 마지막 라운드에는 도구를 빼고 호출해 텍스트 답변을 강제한다.
 */
class SmartChatLlmService
{
    /**
     * @param  list<array{role: string, content: string, parts?: list<array<string, mixed>>}>  $messages
     * @param  callable(string, array<string, mixed>): void  $emit
     * @param  list<array{name: string, description: string, parameters: array<string, mixed>|null}>  $tools
     * @param  (callable(string, array<string, mixed>): array<string, mixed>)|null  $executeTool
     * @return array{content: string, finish_reason: string|null, provider: string, model: string, prompt_tokens: int|null, completion_tokens: int|null, used_tools: list<string>}
     */
    public function streamChat(
        string $modelId,
        array $messages,
        callable $emit,
        string $customInstructions = '',
        array $tools = [],
        ?callable $executeTool = null,
    ): array {
        $resolved = $this->resolveModel($modelId);
        $system = trim((string) config('moabom-smart-chat.system_prompt', ''));
        $custom = trim($customInstructions);
        if ($custom !== '') {
            $system = $system === ''
                ? $custom
                : $system."\n\n# User custom instructions\n".$custom;
        }
        $provider = $resolved['provider'];
        $model = $resolved['model'];
        if ($executeTool === null) {
            $tools = [];
        }

        $result = match ($provider) {
            'anthropic' => $this->streamAnthropic($system, $messages, $model, $emit, $tools, $executeTool),
            'openai' => $this->streamOpenAi($system, $messages, $model, $emit, $tools, $executeTool),
            'google' => $this->streamGoogle($system, $messages, $model, $emit, $tools, $executeTool),
            default => ['content' => '', 'finish_reason' => 'unsupported', 'prompt_tokens' => null, 'completion_tokens' => null, 'used_tools' => []],
        };

        return [
            'content' => $result['content'],
            'finish_reason' => $result['finish_reason'],
            'provider' => $provider,
            'model' => $model,
            'prompt_tokens' => $result['prompt_tokens'] ?? null,
            'completion_tokens' => $result['completion_tokens'] ?? null,
            'used_tools' => $result['used_tools'] ?? [],
        ];
    }

    /**
     * @return array{provider: string, model: string}
     */
    public function resolveModel(string $modelId): array
    {
        $allowed = config('moabom-smart-chat.allowed_model_ids', []);
        if (! in_array($modelId, $allowed, true)) {
            $modelId = (string) config('moabom-smart-chat.default_model_id', 'gemini-flash-lite');
        }

        $models = config('moabom-apps.ai.models', []);
        $entry = $models[$modelId] ?? null;
        if (! is_array($entry)) {
            $entry = $models['gemini-flash-lite'] ?? ['provider' => 'google', 'model' => 'gemini-3.1-flash-lite'];
        }

        return [
            'provider' => (string) ($entry['provider'] ?? 'google'),
            'model' => (string) ($entry['model'] ?? 'gemini-3.1-flash-lite'),
        ];
    }

    /**
     * @return list<array{id: string, provider: string, model: string, label: string}>
     */
    public function listModels(): array
    {
        $out = [];
        $registry = (array) config('moabom-apps.ai.models', []);
        foreach ((array) config('moabom-smart-chat.allowed_model_ids', []) as $id) {
            $resolved = $this->resolveModel((string) $id);
            $entry = $registry[(string) $id] ?? [];
            $label = is_array($entry) ? (string) ($entry['label'] ?? '') : '';
            $out[] = [
                'id' => (string) $id,
                'provider' => $resolved['provider'],
                'model' => $resolved['model'],
                'label' => $label !== '' ? $label : (string) $id,
            ];
        }

        return $out;
    }

    private function maxToolRounds(): int
    {
        return max(0, (int) config('moabom-smart-chat.tools.function_calling.max_iterations', 3));
    }

    /**
     * 도구 실행 + tool SSE 이벤트 방출. 실패해도 error payload 로 스트림 유지.
     *
     * @param  callable(string, array<string, mixed>): array<string, mixed>  $executeTool
     * @param  callable(string, array<string, mixed>): void  $emit
     * @param  array<string, mixed>  $args
     * @param  list<string>  $usedTools
     * @return array<string, mixed>
     */
    private function runTool(callable $executeTool, callable $emit, string $name, array $args, array &$usedTools): array
    {
        $emit('tool', ['name' => $name, 'status' => 'running']);
        try {
            $result = $executeTool($name, $args);
        } catch (\Throwable $e) {
            Log::warning('moabom-smart-chat.tool_failed', ['tool' => $name, 'message' => $e->getMessage()]);
            $result = ['error' => 'tool_failed'];
        }
        $usedTools[] = $name;
        $emit('tool', ['name' => $name, 'status' => 'done']);

        return $result;
    }

    /**
     * @param  list<array{role: string, content: string, parts?: list<array<string, mixed>>}>  $messages
     * @param  callable(string, array<string, mixed>): void  $emit
     * @param  list<array{name: string, description: string, parameters: array<string, mixed>|null}>  $tools
     * @return array{content: string, finish_reason: string|null, prompt_tokens: int|null, completion_tokens: int|null, used_tools: list<string>}
     */
    private function streamOpenAi(string $system, array $messages, string $model, callable $emit, array $tools, ?callable $executeTool): array
    {
        $apiKey = (string) config('moabom-apps.ai.openai_api_key', '');
        if ($apiKey === '') {
            return $this->emitFallback($emit, 'no_key');
        }

        $payloadMessages = [];
        if ($system !== '') {
            $payloadMessages[] = ['role' => 'system', 'content' => $system];
        }
        foreach ($messages as $m) {
            if (! in_array($m['role'], ['user', 'assistant'], true)) {
                continue;
            }
            $payloadMessages[] = [
                'role' => $m['role'],
                'content' => $this->toOpenAiContent($m),
            ];
        }

        $toolSpecs = array_map(static fn (array $t) => [
            'type' => 'function',
            'function' => array_filter([
                'name' => $t['name'],
                'description' => $t['description'],
                'parameters' => $t['parameters'],
            ], static fn ($v) => $v !== null),
        ], $tools);

        $maxRounds = $this->maxToolRounds();
        $content = '';
        $promptTokens = null;
        $completionTokens = null;
        $usedTools = [];

        for ($round = 0; ; $round++) {
            $body = [
                'model' => $model,
                'messages' => $payloadMessages,
                'stream' => true,
                'stream_options' => ['include_usage' => true],
                'max_completion_tokens' => $this->maxTokens(),
            ];
            // 마지막 라운드는 도구 없이 → 텍스트 답변 강제
            if ($toolSpecs !== [] && $round < $maxRounds) {
                $body['tools'] = $toolSpecs;
            }

            $response = Http::withToken($apiKey)
                ->withOptions(['stream' => true])
                ->acceptJson()
                ->timeout((int) config('moabom-smart-chat.stream_timeout', 120))
                ->post('https://api.openai.com/v1/chat/completions', $body);

            if (! $response->successful()) {
                $this->logFailure('openai', $model, $response->status(), $response->body());

                return $this->emitFallback($emit, 'error', $usedTools);
            }

            $res = $this->readOpenAiSse($response, $emit);
            $content .= $res['content'];
            $promptTokens = $this->sumTokens($promptTokens, $res['prompt_tokens']);
            $completionTokens = $this->sumTokens($completionTokens, $res['completion_tokens']);

            $calls = $res['tool_calls'];
            if ($calls === [] || $executeTool === null || $res['finish_reason'] === 'cancelled') {
                return [
                    'content' => $content,
                    'finish_reason' => $res['finish_reason'],
                    'prompt_tokens' => $promptTokens,
                    'completion_tokens' => $completionTokens,
                    'used_tools' => $usedTools,
                ];
            }

            $payloadMessages[] = [
                'role' => 'assistant',
                'content' => $res['content'] !== '' ? $res['content'] : null,
                'tool_calls' => array_map(static fn (array $c) => [
                    'id' => $c['id'],
                    'type' => 'function',
                    'function' => ['name' => $c['name'], 'arguments' => $c['arguments']],
                ], $calls),
            ];
            foreach ($calls as $call) {
                $args = json_decode($call['arguments'], true);
                $result = $this->runTool($executeTool, $emit, $call['name'], is_array($args) ? $args : [], $usedTools);
                $payloadMessages[] = [
                    'role' => 'tool',
                    'tool_call_id' => $call['id'],
                    'content' => json_encode($result, JSON_UNESCAPED_UNICODE),
                ];
            }
        }
    }

    /**
     * @param  list<array{role: string, content: string}>  $messages
     * @param  callable(string, array<string, mixed>): void  $emit
     * @param  list<array{name: string, description: string, parameters: array<string, mixed>|null}>  $tools
     * @return array{content: string, finish_reason: string|null, prompt_tokens: int|null, completion_tokens: int|null, used_tools: list<string>}
     */
    private function streamAnthropic(string $system, array $messages, string $model, callable $emit, array $tools, ?callable $executeTool): array
    {
        $apiKey = (string) config('moabom-apps.ai.anthropic_api_key', '');
        if ($apiKey === '') {
            return $this->emitFallback($emit, 'no_key');
        }

        $anthMessages = [];
        foreach ($messages as $m) {
            if (! in_array($m['role'], ['user', 'assistant'], true)) {
                continue;
            }
            $anthMessages[] = [
                'role' => $m['role'],
                'content' => $this->toAnthropicContent($m),
            ];
        }

        $toolSpecs = array_map(static fn (array $t) => [
            'name' => $t['name'],
            'description' => $t['description'],
            'input_schema' => $t['parameters'] ?? ['type' => 'object', 'properties' => new \stdClass],
        ], $tools);

        $maxRounds = $this->maxToolRounds();
        $content = '';
        $promptTokens = null;
        $completionTokens = null;
        $usedTools = [];

        for ($round = 0; ; $round++) {
            $body = [
                'model' => $model,
                'max_tokens' => $this->maxTokens(),
                'messages' => $anthMessages,
                'stream' => true,
            ];
            if ($system !== '') {
                $body['system'] = $system;
            }
            if ($toolSpecs !== [] && $round < $maxRounds) {
                $body['tools'] = $toolSpecs;
            }

            $response = Http::withHeaders([
                'x-api-key' => $apiKey,
                'anthropic-version' => '2023-06-01',
            ])
                ->withOptions(['stream' => true])
                ->acceptJson()
                ->timeout((int) config('moabom-smart-chat.stream_timeout', 120))
                ->post('https://api.anthropic.com/v1/messages', $body);

            if (! $response->successful()) {
                $this->logFailure('anthropic', $model, $response->status(), $response->body());

                return $this->emitFallback($emit, 'error', $usedTools);
            }

            $res = $this->readAnthropicSse($response, $emit);
            $content .= $res['content'];
            $promptTokens = $this->sumTokens($promptTokens, $res['prompt_tokens']);
            $completionTokens = $this->sumTokens($completionTokens, $res['completion_tokens']);

            $uses = $res['tool_uses'];
            if ($uses === [] || $executeTool === null || $res['finish_reason'] === 'cancelled') {
                return [
                    'content' => $content,
                    'finish_reason' => $res['finish_reason'],
                    'prompt_tokens' => $promptTokens,
                    'completion_tokens' => $completionTokens,
                    'used_tools' => $usedTools,
                ];
            }

            $assistantBlocks = [];
            if ($res['content'] !== '') {
                $assistantBlocks[] = ['type' => 'text', 'text' => $res['content']];
            }
            $resultBlocks = [];
            foreach ($uses as $use) {
                $input = json_decode($use['input_json'], true);
                $input = is_array($input) ? $input : [];
                $assistantBlocks[] = [
                    'type' => 'tool_use',
                    'id' => $use['id'],
                    'name' => $use['name'],
                    'input' => $input === [] ? new \stdClass : $input,
                ];
                $result = $this->runTool($executeTool, $emit, $use['name'], $input, $usedTools);
                $resultBlocks[] = [
                    'type' => 'tool_result',
                    'tool_use_id' => $use['id'],
                    'content' => json_encode($result, JSON_UNESCAPED_UNICODE),
                ];
            }
            $anthMessages[] = ['role' => 'assistant', 'content' => $assistantBlocks];
            $anthMessages[] = ['role' => 'user', 'content' => $resultBlocks];
        }
    }

    /**
     * @param  list<array{role: string, content: string}>  $messages
     * @param  callable(string, array<string, mixed>): void  $emit
     * @param  list<array{name: string, description: string, parameters: array<string, mixed>|null}>  $tools
     * @return array{content: string, finish_reason: string|null, prompt_tokens: int|null, completion_tokens: int|null, used_tools: list<string>}
     */
    private function streamGoogle(string $system, array $messages, string $model, callable $emit, array $tools, ?callable $executeTool): array
    {
        $apiKey = (string) config('moabom-apps.ai.google_api_key', '');
        if ($apiKey === '') {
            return $this->emitFallback($emit, 'no_key');
        }

        $contents = [];
        foreach ($messages as $m) {
            if (! in_array($m['role'], ['user', 'assistant'], true)) {
                continue;
            }
            $contents[] = [
                'role' => $m['role'] === 'assistant' ? 'model' : 'user',
                'parts' => $this->toGoogleParts($m),
            ];
        }

        $declarations = array_map(static fn (array $t) => array_filter([
            'name' => $t['name'],
            'description' => $t['description'],
            'parameters' => $t['parameters'],
        ], static fn ($v) => $v !== null), $tools);

        $maxRounds = $this->maxToolRounds();
        $content = '';
        $promptTokens = null;
        $completionTokens = null;
        $usedTools = [];

        for ($round = 0; ; $round++) {
            $payload = [
                'contents' => $contents,
                'generationConfig' => [
                    'temperature' => 0.7,
                    'maxOutputTokens' => $this->maxTokens(),
                ],
            ];
            if ($system !== '') {
                $payload['systemInstruction'] = [
                    'parts' => [['text' => $system]],
                ];
            }
            if ($declarations !== [] && $round < $maxRounds) {
                $payload['tools'] = [['functionDeclarations' => $declarations]];
            }

            $response = Http::withOptions(['stream' => true])
                ->acceptJson()
                ->timeout((int) config('moabom-smart-chat.stream_timeout', 120))
                ->post(
                    "https://generativelanguage.googleapis.com/v1beta/models/{$model}:streamGenerateContent?alt=sse&key={$apiKey}",
                    $payload
                );

            if (! $response->successful()) {
                $this->logFailure('google', $model, $response->status(), $response->body());

                return $this->emitFallback($emit, 'error', $usedTools);
            }

            $res = $this->readGoogleSse($response, $emit);
            $content .= $res['content'];
            $promptTokens = $this->sumTokens($promptTokens, $res['prompt_tokens']);
            $completionTokens = $this->sumTokens($completionTokens, $res['completion_tokens']);

            $calls = $res['function_calls'];
            if ($calls === [] || $executeTool === null || $res['finish_reason'] === 'cancelled') {
                return [
                    'content' => $content,
                    'finish_reason' => $res['finish_reason'],
                    'prompt_tokens' => $promptTokens,
                    'completion_tokens' => $completionTokens,
                    'used_tools' => $usedTools,
                ];
            }

            $modelParts = [];
            if ($res['content'] !== '') {
                $textPart = ['text' => $res['content']];
                if (is_string($res['text_signature'] ?? null)) {
                    $textPart['thoughtSignature'] = $res['text_signature'];
                }
                $modelParts[] = $textPart;
            }
            $responseParts = [];
            foreach ($calls as $call) {
                $args = is_array($call['args']) ? $call['args'] : [];
                $fcPart = [
                    'functionCall' => [
                        'name' => $call['name'],
                        'args' => $args === [] ? new \stdClass : $args,
                    ],
                ];
                // Gemini 3.x: functionCall part 의 thoughtSignature 를 그대로 돌려줘야 함 (누락 시 400)
                if (is_string($call['thought_signature'] ?? null)) {
                    $fcPart['thoughtSignature'] = $call['thought_signature'];
                }
                $modelParts[] = $fcPart;
                $result = $this->runTool($executeTool, $emit, $call['name'], $args, $usedTools);
                $responseParts[] = [
                    'functionResponse' => [
                        'name' => $call['name'],
                        'response' => $this->toJsonObject($result),
                    ],
                ];
            }
            $contents[] = ['role' => 'model', 'parts' => $modelParts];
            $contents[] = ['role' => 'user', 'parts' => $responseParts];
        }
    }

    /**
     * @param  array{role: string, content: string, parts?: list<array<string, mixed>>}  $m
     * @return string|list<array<string, mixed>>
     */
    private function toOpenAiContent(array $m): string|array
    {
        $parts = $m['parts'] ?? [];
        if ($parts === []) {
            return (string) $m['content'];
        }

        $blocks = [];
        $text = trim((string) $m['content']);
        $extraText = '';
        foreach ($parts as $part) {
            $type = (string) ($part['type'] ?? '');
            if ($type === 'image' && ! empty($part['base64']) && ! empty($part['mime'])) {
                $blocks[] = [
                    'type' => 'image_url',
                    'image_url' => [
                        'url' => 'data:'.$part['mime'].';base64,'.$part['base64'],
                    ],
                ];
            } elseif ($type === 'file_text') {
                $extraText .= "\n\n[File: ".($part['name'] ?? 'document')."]\n".($part['text'] ?? '');
            } elseif ($type === 'file_ref' || $type === 'file_binary') {
                $extraText .= "\n\n[Attached file: ".($part['name'] ?? 'file').']';
            }
        }
        $full = trim($text.$extraText);
        if ($full !== '') {
            array_unshift($blocks, ['type' => 'text', 'text' => $full]);
        }

        return $blocks === [] ? (string) $m['content'] : $blocks;
    }

    /**
     * @param  array{role: string, content: string, parts?: list<array<string, mixed>>}  $m
     * @return string|list<array<string, mixed>>
     */
    private function toAnthropicContent(array $m): string|array
    {
        $parts = $m['parts'] ?? [];
        if ($parts === []) {
            return (string) $m['content'];
        }

        $blocks = [];
        $text = trim((string) $m['content']);
        $extraText = '';
        foreach ($parts as $part) {
            $type = (string) ($part['type'] ?? '');
            if ($type === 'image' && ! empty($part['base64']) && ! empty($part['mime'])) {
                $blocks[] = [
                    'type' => 'image',
                    'source' => [
                        'type' => 'base64',
                        'media_type' => $part['mime'],
                        'data' => $part['base64'],
                    ],
                ];
            } elseif ($type === 'file_text') {
                $extraText .= "\n\n[File: ".($part['name'] ?? 'document')."]\n".($part['text'] ?? '');
            } elseif ($type === 'file_ref' || $type === 'file_binary') {
                $extraText .= "\n\n[Attached file: ".($part['name'] ?? 'file').']';
            }
        }
        $full = trim($text.$extraText);
        if ($full !== '') {
            array_unshift($blocks, ['type' => 'text', 'text' => $full]);
        }

        return $blocks === [] ? (string) $m['content'] : $blocks;
    }

    /**
     * @param  array{role: string, content: string, parts?: list<array<string, mixed>>}  $m
     * @return list<array<string, mixed>>
     */
    private function toGoogleParts(array $m): array
    {
        $parts = [];
        $text = trim((string) $m['content']);
        $extraText = '';
        foreach ($m['parts'] ?? [] as $part) {
            $type = (string) ($part['type'] ?? '');
            if (($type === 'image' || $type === 'file_binary') && ! empty($part['base64']) && ! empty($part['mime'])) {
                $parts[] = [
                    'inline_data' => [
                        'mime_type' => $part['mime'],
                        'data' => $part['base64'],
                    ],
                ];
            } elseif ($type === 'file_text') {
                $extraText .= "\n\n[File: ".($part['name'] ?? 'document')."]\n".($part['text'] ?? '');
            } elseif ($type === 'file_ref') {
                $extraText .= "\n\n[Attached file: ".($part['name'] ?? 'file').']';
            }
        }
        $full = trim($text.$extraText);
        if ($full !== '') {
            array_unshift($parts, ['text' => $full]);
        }
        if ($parts === []) {
            $parts[] = ['text' => (string) $m['content']];
        }

        return $parts;
    }

    /**
     * @param  callable(string, array<string, mixed>): void  $emit
     * @param  list<string>  $usedTools
     * @return array{content: string, finish_reason: string|null, prompt_tokens: int|null, completion_tokens: int|null, used_tools: list<string>}
     */
    private function emitFallback(callable $emit, string $reason, array $usedTools = []): array
    {
        $text = match ($reason) {
            'no_key' => __('moabom-smart-chat::messages.llm.no_key'),
            default => __('moabom-smart-chat::messages.llm.upstream_failed'),
        };
        $emit('delta', ['text' => $text]);

        return [
            'content' => $text,
            'finish_reason' => $reason,
            'prompt_tokens' => null,
            'completion_tokens' => null,
            'used_tools' => $usedTools,
        ];
    }

    private function sumTokens(?int $current, ?int $add): ?int
    {
        if ($add === null) {
            return $current;
        }

        return ($current ?? 0) + $add;
    }

    /**
     * Gemini functionResponse.response 는 JSON object 여야 한다 — list/빈 배열 보정.
     *
     * @param  array<string, mixed>  $result
     */
    private function toJsonObject(array $result): object|array
    {
        if ($result === []) {
            return new \stdClass;
        }

        return array_is_list($result) ? ['items' => $result] : $result;
    }

    /**
     * @param  callable(string, array<string, mixed>): void  $emit
     * @return array{content: string, finish_reason: string|null, prompt_tokens: int|null, completion_tokens: int|null, tool_calls: list<array{id: string, name: string, arguments: string}>}
     */
    private function readOpenAiSse(\Illuminate\Http\Client\Response $response, callable $emit): array
    {
        $body = $response->toPsrResponse()->getBody();
        $buffer = '';
        $content = '';
        $finishReason = null;
        $promptTokens = null;
        $completionTokens = null;
        /** @var array<int, array{id: string, name: string, arguments: string}> $toolCalls */
        $toolCalls = [];

        while (! $body->eof()) {
            if (connection_aborted()) {
                return [
                    'content' => $content,
                    'finish_reason' => 'cancelled',
                    'prompt_tokens' => $promptTokens,
                    'completion_tokens' => $completionTokens,
                    'tool_calls' => [],
                ];
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
                $callFragments = data_get($chunk, 'choices.0.delta.tool_calls');
                if (is_array($callFragments)) {
                    foreach ($callFragments as $fragment) {
                        if (! is_array($fragment)) {
                            continue;
                        }
                        $idx = (int) ($fragment['index'] ?? 0);
                        if (! isset($toolCalls[$idx])) {
                            $toolCalls[$idx] = ['id' => '', 'name' => '', 'arguments' => ''];
                        }
                        if (! empty($fragment['id'])) {
                            $toolCalls[$idx]['id'] = (string) $fragment['id'];
                        }
                        $fn = $fragment['function'] ?? [];
                        if (is_array($fn)) {
                            if (! empty($fn['name'])) {
                                $toolCalls[$idx]['name'] .= (string) $fn['name'];
                            }
                            if (isset($fn['arguments'])) {
                                $toolCalls[$idx]['arguments'] .= (string) $fn['arguments'];
                            }
                        }
                    }
                }
                $fr = data_get($chunk, 'choices.0.finish_reason');
                if (is_string($fr) && $fr !== '') {
                    $finishReason = $fr;
                }
                if (isset($chunk['usage']) && is_array($chunk['usage'])) {
                    $promptTokens = isset($chunk['usage']['prompt_tokens'])
                        ? (int) $chunk['usage']['prompt_tokens']
                        : $promptTokens;
                    $completionTokens = isset($chunk['usage']['completion_tokens'])
                        ? (int) $chunk['usage']['completion_tokens']
                        : $completionTokens;
                }
            }
        }

        return [
            'content' => $content,
            'finish_reason' => $finishReason,
            'prompt_tokens' => $promptTokens,
            'completion_tokens' => $completionTokens,
            'tool_calls' => array_values(array_filter(
                $toolCalls,
                static fn (array $c) => $c['id'] !== '' && $c['name'] !== '',
            )),
        ];
    }

    /**
     * @param  callable(string, array<string, mixed>): void  $emit
     * @return array{content: string, finish_reason: string|null, prompt_tokens: int|null, completion_tokens: int|null, tool_uses: list<array{id: string, name: string, input_json: string}>}
     */
    private function readAnthropicSse(\Illuminate\Http\Client\Response $response, callable $emit): array
    {
        $body = $response->toPsrResponse()->getBody();
        $buffer = '';
        $content = '';
        $finishReason = null;
        $promptTokens = null;
        $completionTokens = null;
        /** @var array<int, array{id: string, name: string, input_json: string}> $toolUses */
        $toolUses = [];

        while (! $body->eof()) {
            if (connection_aborted()) {
                return [
                    'content' => $content,
                    'finish_reason' => 'cancelled',
                    'prompt_tokens' => $promptTokens,
                    'completion_tokens' => $completionTokens,
                    'tool_uses' => [],
                ];
            }
            $buffer .= $body->read(2048);
            while (($pos = strpos($buffer, "\n")) !== false) {
                $line = trim(substr($buffer, 0, $pos));
                $buffer = substr($buffer, $pos + 1);
                if (! str_starts_with($line, 'data:')) {
                    continue;
                }
                $json = trim(substr($line, 5));
                if ($json === '') {
                    continue;
                }
                $chunk = json_decode($json, true);
                if (! is_array($chunk)) {
                    continue;
                }
                $type = (string) ($chunk['type'] ?? '');
                if ($type === 'content_block_start') {
                    $block = $chunk['content_block'] ?? [];
                    if (is_array($block) && ($block['type'] ?? '') === 'tool_use') {
                        $idx = (int) ($chunk['index'] ?? 0);
                        $toolUses[$idx] = [
                            'id' => (string) ($block['id'] ?? ''),
                            'name' => (string) ($block['name'] ?? ''),
                            'input_json' => '',
                        ];
                    }
                }
                if ($type === 'content_block_delta') {
                    $deltaType = (string) data_get($chunk, 'delta.type', '');
                    if ($deltaType === 'input_json_delta') {
                        $idx = (int) ($chunk['index'] ?? 0);
                        if (isset($toolUses[$idx])) {
                            $toolUses[$idx]['input_json'] .= (string) data_get($chunk, 'delta.partial_json', '');
                        }
                    } else {
                        $delta = (string) data_get($chunk, 'delta.text', '');
                        if ($delta !== '') {
                            $content .= $delta;
                            $emit('delta', ['text' => $delta]);
                        }
                    }
                }
                if ($type === 'message_start') {
                    $promptTokens = isset($chunk['message']['usage']['input_tokens'])
                        ? (int) $chunk['message']['usage']['input_tokens']
                        : $promptTokens;
                }
                if ($type === 'message_delta') {
                    $fr = data_get($chunk, 'delta.stop_reason');
                    if (is_string($fr) && $fr !== '') {
                        $finishReason = $fr;
                    }
                    $completionTokens = isset($chunk['usage']['output_tokens'])
                        ? (int) $chunk['usage']['output_tokens']
                        : $completionTokens;
                }
            }
        }

        return [
            'content' => $content,
            'finish_reason' => $finishReason,
            'prompt_tokens' => $promptTokens,
            'completion_tokens' => $completionTokens,
            'tool_uses' => array_values(array_filter(
                $toolUses,
                static fn (array $u) => $u['id'] !== '' && $u['name'] !== '',
            )),
        ];
    }

    /**
     * @param  callable(string, array<string, mixed>): void  $emit
     * @return array{content: string, finish_reason: string|null, prompt_tokens: int|null, completion_tokens: int|null, text_signature: string|null, function_calls: list<array{name: string, args: array<string, mixed>, thought_signature: string|null}>}
     */
    private function readGoogleSse(\Illuminate\Http\Client\Response $response, callable $emit): array
    {
        $body = $response->toPsrResponse()->getBody();
        $buffer = '';
        $content = '';
        $finishReason = null;
        $promptTokens = null;
        $completionTokens = null;
        $functionCalls = [];
        $textSignature = null;

        while (! $body->eof()) {
            if (connection_aborted()) {
                return [
                    'content' => $content,
                    'finish_reason' => 'cancelled',
                    'prompt_tokens' => $promptTokens,
                    'completion_tokens' => $completionTokens,
                    'text_signature' => null,
                    'function_calls' => [],
                ];
            }
            $buffer .= $body->read(2048);
            while (($pos = strpos($buffer, "\n")) !== false) {
                $line = trim(substr($buffer, 0, $pos));
                $buffer = substr($buffer, $pos + 1);
                if (! str_starts_with($line, 'data:')) {
                    continue;
                }
                $json = trim(substr($line, 5));
                if ($json === '') {
                    continue;
                }
                $chunk = json_decode($json, true);
                if (! is_array($chunk)) {
                    continue;
                }
                $parts = data_get($chunk, 'candidates.0.content.parts', []);
                if (is_array($parts)) {
                    foreach ($parts as $part) {
                        if (! is_array($part)) {
                            continue;
                        }
                        // Gemini 3.x thought signature — 다음 라운드 요청에 그대로 돌려줘야 한다
                        $sig = isset($part['thoughtSignature']) && is_string($part['thoughtSignature'])
                            ? $part['thoughtSignature']
                            : null;
                        $text = (string) ($part['text'] ?? '');
                        if ($text !== '') {
                            $content .= $text;
                            $emit('delta', ['text' => $text]);
                            if ($sig !== null) {
                                $textSignature = $sig;
                            }
                        }
                        $fc = $part['functionCall'] ?? null;
                        if (is_array($fc) && ! empty($fc['name'])) {
                            $functionCalls[] = [
                                'name' => (string) $fc['name'],
                                'args' => is_array($fc['args'] ?? null) ? $fc['args'] : [],
                                'thought_signature' => $sig,
                            ];
                        }
                    }
                }
                $fr = data_get($chunk, 'candidates.0.finishReason');
                if (is_string($fr) && $fr !== '') {
                    $finishReason = $fr;
                }
                $usage = $chunk['usageMetadata'] ?? null;
                if (is_array($usage)) {
                    $promptTokens = isset($usage['promptTokenCount'])
                        ? (int) $usage['promptTokenCount']
                        : $promptTokens;
                    if (isset($usage['candidatesTokenCount'])) {
                        $completionTokens = (int) $usage['candidatesTokenCount'];
                    } elseif (isset($usage['totalTokenCount']) && $promptTokens !== null) {
                        $completionTokens = max(0, (int) $usage['totalTokenCount'] - $promptTokens);
                    }
                }
            }
        }

        return [
            'content' => $content,
            'finish_reason' => $finishReason,
            'prompt_tokens' => $promptTokens,
            'completion_tokens' => $completionTokens,
            'text_signature' => $textSignature,
            'function_calls' => $functionCalls,
        ];
    }

    private function maxTokens(): int
    {
        return max(256, (int) config('moabom-smart-chat.max_output_tokens', 4096));
    }

    private function logFailure(string $provider, string $model, int $status, string $body): void
    {
        Log::warning('moabom-smart-chat.llm_upstream_failed', [
            'provider' => $provider,
            'model' => $model,
            'status' => $status,
            'body' => mb_substr($body, 0, 500),
        ]);
    }
}
