<?php

namespace Modules\Moabom\Smart\Chat\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreMemoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        // summarize=true 인 "기억하기" 는 답변 전문을 받아 서버에서 팩트 요약 후 저장한다.
        // 저장 길이 제한(memory.max_chars)은 MemoryService::normalizeContent 가 보장.
        return [
            'content' => ['required', 'string', 'max:20000'],
            'conversation_uuid' => ['nullable', 'uuid'],
            'summarize' => ['sometimes', 'boolean'],
        ];
    }
}
