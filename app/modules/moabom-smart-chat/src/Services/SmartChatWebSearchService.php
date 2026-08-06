<?php

namespace Modules\Moabom\Smart\Chat\Services;

use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * 웹검색 옵트인 — 외부 키 없이 DuckDuckGo Instant Answer.
 * 결과는 출처와 함께 LLM 컨텍스트에만 넣고, 실패해도 스트림은 계속.
 */
class SmartChatWebSearchService
{
    /**
     * @return array{ok: bool, query: string, text: string, sources: list<array{title: string, url: string}>}
     */
    public function search(string $query): array
    {
        $query = trim($query);
        $max = (int) config('moabom-smart-chat.tools.web_search.max_query_chars', 200);
        if (mb_strlen($query) > $max) {
            $query = mb_substr($query, 0, $max);
        }

        if ($query === '') {
            return ['ok' => false, 'query' => '', 'text' => '', 'sources' => []];
        }

        if (! (bool) config('moabom-smart-chat.tools.web_search.enabled', true)) {
            return ['ok' => false, 'query' => $query, 'text' => '', 'sources' => []];
        }

        try {
            $response = Http::timeout((int) config('moabom-smart-chat.tools.web_search.timeout', 6))
                ->acceptJson()
                ->get('https://api.duckduckgo.com/', [
                    'q' => $query,
                    'format' => 'json',
                    'no_html' => 1,
                    'skip_disambig' => 1,
                ]);

            if (! $response->successful()) {
                return ['ok' => false, 'query' => $query, 'text' => '', 'sources' => []];
            }

            $json = $response->json() ?? [];
            $abstract = trim((string) ($json['AbstractText'] ?? ''));
            $abstractUrl = trim((string) ($json['AbstractURL'] ?? ''));
            $heading = trim((string) ($json['Heading'] ?? ''));
            $sources = [];
            $chunks = [];

            if ($abstract !== '') {
                $chunks[] = ($heading !== '' ? $heading."\n" : '').$abstract;
                if ($abstractUrl !== '') {
                    $sources[] = ['title' => $heading !== '' ? $heading : 'DuckDuckGo', 'url' => $abstractUrl];
                }
            }

            $topics = is_array($json['RelatedTopics'] ?? null) ? $json['RelatedTopics'] : [];
            $limit = (int) config('moabom-smart-chat.tools.web_search.max_results', 5);
            foreach ($topics as $topic) {
                if (count($sources) >= $limit) {
                    break;
                }
                if (! is_array($topic)) {
                    continue;
                }
                if (isset($topic['Topics']) && is_array($topic['Topics'])) {
                    foreach ($topic['Topics'] as $sub) {
                        if (! is_array($sub) || count($sources) >= $limit) {
                            continue;
                        }
                        $this->pushTopic($sub, $chunks, $sources);
                    }
                    continue;
                }
                $this->pushTopic($topic, $chunks, $sources);
            }

            $text = trim(implode("\n\n", $chunks));
            if ($text === '') {
                return ['ok' => false, 'query' => $query, 'text' => '', 'sources' => []];
            }

            $maxChars = (int) config('moabom-smart-chat.tools.web_search.max_context_chars', 4000);
            if (mb_strlen($text) > $maxChars) {
                $text = mb_substr($text, 0, $maxChars).'…';
            }

            return [
                'ok' => true,
                'query' => $query,
                'text' => "[web_search]\nquery: {$query}\n\n{$text}",
                'sources' => $sources,
            ];
        } catch (Throwable) {
            return ['ok' => false, 'query' => $query, 'text' => '', 'sources' => []];
        }
    }

    /**
     * @param  array<string, mixed>  $topic
     * @param  list<string>  $chunks
     * @param  list<array{title: string, url: string}>  $sources
     */
    private function pushTopic(array $topic, array &$chunks, array &$sources): void
    {
        $text = trim((string) ($topic['Text'] ?? ''));
        $url = trim((string) ($topic['FirstURL'] ?? ''));
        if ($text === '') {
            return;
        }
        $chunks[] = $text;
        if ($url !== '') {
            $sources[] = [
                'title' => mb_substr($text, 0, 80),
                'url' => $url,
            ];
        }
    }
}
