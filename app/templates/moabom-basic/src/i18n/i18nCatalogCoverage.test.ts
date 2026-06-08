import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = path.resolve(__dirname, '..', '..');
const SRC_DIR = path.join(TEMPLATE_ROOT, 'src');
const LAYOUTS_DIR = path.join(TEMPLATE_ROOT, 'layouts');
const LOCALES = ['ko', 'en', 'ja', 'zh'] as const;

const TEST_FILE_PATTERN = /\.(test|spec)\.[cm]?[jt]sx?$/;

function walkFiles(dir: string, exts: string[], out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === '__mocks__') {
        continue;
      }
      walkFiles(abs, exts, out);
    } else if (exts.some((ext) => abs.endsWith(ext)) && !TEST_FILE_PATTERN.test(entry.name)) {
      out.push(abs);
    }
  }
  return out;
}

function collectMoaKeysFromCode(): string[] {
  const files = [
    ...walkFiles(SRC_DIR, ['.ts', '.tsx']),
    ...walkFiles(LAYOUTS_DIR, ['.json']),
  ];
  const keys = new Set<string>();

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');

    for (const m of text.matchAll(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(\s*(['"])([^'"\n]+)\1\s*[),]/g)) {
      const key = m[2];
      if (key.startsWith('moa_') && key.includes('.') && !key.endsWith('.')) {
        keys.add(key);
      }
    }

    for (const m of text.matchAll(/\$t:([a-zA-Z0-9_.-]+)/g)) {
      const key = m[1];
      if (key.startsWith('moa_') && key.includes('.')) {
        keys.add(key);
      }
    }
  }

  return [...keys].sort();
}

function hasDottedKey(catalog: unknown, dotted: string): boolean {
  const parts = dotted.split('.');
  let cursor: unknown = catalog;
  for (const part of parts) {
    if (typeof cursor !== 'object' || cursor === null || !(part in cursor)) {
      return false;
    }
    cursor = (cursor as Record<string, unknown>)[part];
  }

  return typeof cursor === 'string' || typeof cursor === 'number' || typeof cursor === 'boolean';
}

describe('moabom i18n catalog coverage', () => {
  it('모든 moa_* 키는 각 locale 카탈로그에 존재해야 한다', () => {
    const keys = collectMoaKeysFromCode();

    for (const locale of LOCALES) {
      const localePath = path.join(TEMPLATE_ROOT, 'lang', `${locale}.json`);
      const catalog = JSON.parse(fs.readFileSync(localePath, 'utf8')) as unknown;
      const missing = keys.filter((key) => !hasDottedKey(catalog, key));

      expect(
        missing,
        `[${locale}] missing keys:\n${missing.join('\n')}`,
      ).toEqual([]);
    }
  });
});

