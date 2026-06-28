<?php

namespace Plugins\Moabom\Weather\Tests\Unit;

use Illuminate\Http\Request;
use Plugins\Moabom\Weather\Http\Support\WeatherConditionalHeaders;
use Plugins\Moabom\Weather\Tests\PluginTestCase;

final class WeatherConditionalHeadersTest extends PluginTestCase
{
    public function test_build_includes_weak_etag_and_cache_control(): void
    {
        $headers = WeatherConditionalHeaders::build(37.56, 127.03, 'ko', '2026-06-28T12:00:00+00:00');

        $this->assertStringStartsWith('W/"mw:37.6:127.0:ko:', $headers['ETag']);
        $this->assertNotEmpty($headers['Last-Modified']);
        $this->assertSame('private, max-age=300', $headers['Cache-Control']);
    }

    public function test_matches_not_modified_when_if_none_match_equals_etag(): void
    {
        $fetchedAt = '2026-06-28T12:00:00+00:00';
        $headers = WeatherConditionalHeaders::build(37.5, 127.0, 'ko', $fetchedAt);

        $request = Request::create('/weather/current', 'GET', [], [], [], [
            'HTTP_IF_NONE_MATCH' => $headers['ETag'],
        ]);

        $this->assertTrue(WeatherConditionalHeaders::matchesNotModified($request, $headers));
    }

    public function test_rejects_oversized_if_none_match_header(): void
    {
        $headers = WeatherConditionalHeaders::build(37.5, 127.0, 'ko', '2026-06-28T12:00:00+00:00');
        $request = Request::create('/weather/current', 'GET', [], [], [], [
            'HTTP_IF_NONE_MATCH' => str_repeat('x', 300),
        ]);

        $this->assertFalse(WeatherConditionalHeaders::matchesNotModified($request, $headers));
    }
}
