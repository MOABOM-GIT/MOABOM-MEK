import { describe, expect, it, vi } from 'vitest';
import {
  decodeGeneratedAppDownloadPayload,
  handleMoabomAppFileDownloadMessage,
  isAllowedGeneratedAppDownloadMimeType,
  parseMoabomAppFileDownloadMessage,
  sanitizeGeneratedAppDownloadFilename,
  triggerGeneratedAppDownload,
} from './generatedAppIframeBridge';

describe('generatedAppIframeBridge', () => {
  it('sanitizes path traversal in filenames', () => {
    expect(sanitizeGeneratedAppDownloadFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeGeneratedAppDownloadFilename('logs/export.csv')).toBe('export.csv');
  });

  it('rejects executable mime types', () => {
    expect(isAllowedGeneratedAppDownloadMimeType('text/html')).toBe(false);
    expect(isAllowedGeneratedAppDownloadMimeType('text/javascript')).toBe(false);
    expect(isAllowedGeneratedAppDownloadMimeType('text/csv')).toBe(true);
    expect(isAllowedGeneratedAppDownloadMimeType('application/json')).toBe(true);
  });

  it('parses valid file-download messages', () => {
    const parsed = parseMoabomAppFileDownloadMessage({
      source: 'moabom-app',
      type: 'file-download',
      filename: 'calc-log.csv',
      mimeType: 'text/csv',
      encoding: 'utf8',
      data: 'a,b,c',
    });
    expect(parsed?.filename).toBe('calc-log.csv');
    expect(parsed?.encoding).toBe('utf8');
  });

  it('rejects oversized base64 payloads', () => {
    const parsed = parseMoabomAppFileDownloadMessage({
      source: 'moabom-app',
      type: 'file-download',
      filename: 'big.bin',
      mimeType: 'application/octet-stream',
      encoding: 'base64',
      data: 'A'.repeat(20_000_000),
    });
    expect(parsed).toBeNull();
  });

  it('decodes utf8 and base64 payloads', () => {
    expect(Array.from(decodeGeneratedAppDownloadPayload('utf8', 'hello') ?? [])).toEqual([
      104, 101, 108, 108, 111,
    ]);
    expect(Array.from(decodeGeneratedAppDownloadPayload('base64', btoa('abc')) ?? [])).toEqual([
      97, 98, 99,
    ]);
  });

  it('triggers parent download via temporary anchor', () => {
    const click = vi.fn();
    const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      Object.defineProperty(node, 'click', { value: click });
      return node;
    });
    const remove = vi.spyOn(HTMLElement.prototype, 'remove').mockImplementation(() => {});
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const ok = triggerGeneratedAppDownload(new Uint8Array([1, 2, 3]), 'sample.bin', 'application/octet-stream');

    expect(ok).toBe(true);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');

    appendChild.mockRestore();
    remove.mockRestore();
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });

  it('handles end-to-end file-download messages', () => {
    const click = vi.fn();
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      Object.defineProperty(node, 'click', { value: click });
      return node;
    });
    vi.spyOn(HTMLElement.prototype, 'remove').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const ok = handleMoabomAppFileDownloadMessage({
      source: 'moabom-app',
      type: 'file-download',
      filename: 'log.txt',
      mimeType: 'text/plain',
      encoding: 'utf8',
      data: 'line-1',
    });

    expect(ok).toBe(true);
    expect(click).toHaveBeenCalledTimes(1);
  });
});
