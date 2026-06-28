<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Moabom\Apps\Enums\AppCommunityPostType;

class StoreAppCommunityPostRequest extends FormRequest
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
        return [
            'title' => ['required', 'string', 'max:120'],
            'body' => ['required', 'string', 'max:10000'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'post_type' => ['sometimes', 'string', Rule::in([AppCommunityPostType::Review->value])],
        ];
    }

    /**
     * @return array{title: string, body: string, rating: int}
     */
    public function validatedReview(): array
    {
        $validated = $this->validated();

        return [
            'title' => trim((string) $validated['title']),
            'body' => trim((string) $validated['body']),
            'rating' => (int) $validated['rating'],
        ];
    }
}
