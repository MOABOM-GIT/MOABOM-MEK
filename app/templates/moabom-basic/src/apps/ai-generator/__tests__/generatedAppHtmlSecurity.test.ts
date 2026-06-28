import { describe, expect, it } from 'vitest';
import { scanGeneratedAppHtmlSecurity } from '../generatedAppHtmlSecurity';

const COMPLETE_SHELL = '<!DOCTYPE html><html><head><title>x</title></head><body>';

describe('generatedAppHtmlSecurity', () => {
  it('Three.js·Chart.js·Phaser CDN 과 게임 루프를 허용한다', () => {
    const html = `${COMPLETE_SHELL}
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js"></script>
<canvas></canvas>
<script>const s=new THREE.Scene();requestAnimationFrame(()=>{});</script>
</body></html>`;

    expect(scanGeneratedAppHtmlSecurity(html).ok).toBe(true);
  });

  it('부모 셸 접근 코드를 차단한다', () => {
    const html = `${COMPLETE_SHELL}<script>parent.document.cookie</script></body></html>`;
    const result = scanGeneratedAppHtmlSecurity(html);

    expect(result.ok).toBe(false);
    expect(result.violations.some((item) => item.ruleId === 'parent_shell_escape')).toBe(true);
  });

  it('HTTP 스크립트 CDN 을 차단한다', () => {
    const html = `${COMPLETE_SHELL}<script src="http://evil.test/a.js"></script></body></html>`;
    const result = scanGeneratedAppHtmlSecurity(html);

    expect(result.violations.some((item) => item.ruleId === 'insecure_remote_script')).toBe(true);
  });

  it('본문 텍스트에 parent.document 가 있어도 차단하지 않는다', () => {
    const html = `${COMPLETE_SHELL}<p>parent.document example</p></body></html>`;

    expect(scanGeneratedAppHtmlSecurity(html).ok).toBe(true);
  });
});
