import { describe, expect, it } from 'vitest';
import {
  generatedAppFrameSandbox,
  resolveGeneratedAppFrameUrl,
  resolveGeneratedAppPreviewUrl,
} from './generatedAppPreviewUrl';

describe('generatedAppPreviewUrl', () => {
  it('resolveGeneratedAppPreviewUrl uses preview_url for AI apps', () => {
    const url = resolveGeneratedAppPreviewUrl({
      id: 7,
      preview_url: 'https://apps.mek360.com/g/7',
    });

    expect(url).toBe('https://apps.mek360.com/g/7');
  });

  it('resolveGeneratedAppFrameUrl uses metadata website_url for website_link', () => {
    const url = resolveGeneratedAppFrameUrl({
      id: 9,
      app_type: 'website_link',
      metadata: { website_url: 'https://www.naver.com' },
      preview_url: 'https://apps.mek360.com/g/9',
    });

    expect(url).toBe('https://www.naver.com');
  });

  it('resolveGeneratedAppFrameUrl falls back to legacy stored iframe src', () => {
    const url = resolveGeneratedAppFrameUrl({
      id: 9,
      app_type: 'website_link',
      html: '<iframe src="https://example.com"></iframe>',
    });

    expect(url).toBe('https://example.com');
  });

  it('generatedAppFrameSandbox uses external-site policy for website_link', () => {
    expect(generatedAppFrameSandbox('https://www.naver.com', 'website_link')).toBe(
      'allow-scripts allow-forms allow-modals allow-popups allow-same-origin',
    );
    expect(generatedAppFrameSandbox('https://apps.mek360.com/g/1', 'general')).toBe(
      'allow-scripts allow-same-origin',
    );
  });
});
