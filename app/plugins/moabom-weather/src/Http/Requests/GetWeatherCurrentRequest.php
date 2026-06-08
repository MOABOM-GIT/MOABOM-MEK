<?php

namespace Plugins\Moabom\Weather\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * `GET /api/plugins/moabom-weather/weather/current` 요청 검증.
 *
 * Req 7.4: `lat`(|v| ≤ 90) · `lon`(|v| ≤ 180) · `lang`(ko|en|ja|zh, 기본 ko) 을 검증한다.
 */
class GetWeatherCurrentRequest extends FormRequest
{
    public function authorize(): bool
    {
        // 공개 엔드포인트. 권한 체크는 throttle 로만 수행한다.
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lon' => ['required', 'numeric', 'between:-180,180'],
            'lang' => ['sometimes', Rule::in(['ko', 'en', 'ja', 'zh'])],
        ];
    }

    /**
     * 검증 통과한 `lat` · `lon` · `lang` 을 정규화 형태로 제공한다.
     *
     * @return array{lat: float, lon: float, lang: string}
     */
    public function resolved(): array
    {
        $validated = $this->validated();

        return [
            'lat' => (float) $validated['lat'],
            'lon' => (float) $validated['lon'],
            'lang' => $validated['lang'] ?? 'ko',
        ];
    }
}
