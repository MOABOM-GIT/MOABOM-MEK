import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const layoutPath = path.resolve(
  __dirname,
  '../../../../../../modules/moabom-system/resources/layouts/admin/admin_realtime_vm.json',
);

const layout = JSON.parse(readFileSync(layoutPath, 'utf8'));

function walk(node: unknown, predicate: (node: Record<string, unknown>) => boolean): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') {
    return null;
  }

  const record = node as Record<string, unknown>;
  if (predicate(record)) {
    return record;
  }

  const children = Array.isArray(record.children) ? record.children : [];
  for (const child of children) {
    const found = walk(child, predicate);
    if (found) {
      return found;
    }
  }

  const slots = record.slots && typeof record.slots === 'object'
    ? Object.values(record.slots as Record<string, unknown>).flat()
    : [];
  for (const child of slots) {
    const found = walk(child, predicate);
    if (found) {
      return found;
    }
  }

  return null;
}

function collectTextBindings(node: unknown, bindings: string[] = []): string[] {
  if (!node || typeof node !== 'object') {
    return bindings;
  }

  const record = node as Record<string, unknown>;
  if (typeof record.text === 'string' && record.text.includes('_computed.')) {
    bindings.push(record.text);
  }

  const children = Array.isArray(record.children) ? record.children : [];
  for (const child of children) {
    collectTextBindings(child, bindings);
  }

  const slots = record.slots && typeof record.slots === 'object'
    ? Object.values(record.slots as Record<string, unknown>).flat()
    : [];
  for (const child of slots) {
    collectTextBindings(child, bindings);
  }

  return bindings;
}

describe('admin_realtime_vm layout', () => {
  it('uses scalar computed keys for websocket, runtime, process, and architecture panels', () => {
    const computed = layout.computed ?? {};
    const required = [
      'wsHttpStatus',
      'clientEndpoint',
      'procNginx',
      'containerReverbText',
      'archVm',
      'vmMetricsAvailable',
    ];

    for (const key of required) {
      expect(computed).toHaveProperty(key);
    }

    expect(computed).not.toHaveProperty('wsProbe');
    expect(computed).not.toHaveProperty('runtimeConfig');
    expect(computed).not.toHaveProperty('vmMetricsData');
  });

  it('binds websocket and runtime cards to _computed text expressions', () => {
    const bindings = collectTextBindings(layout);
    expect(bindings.some(text => text.includes('_computed.wsHttpStatus'))).toBe(true);
    expect(bindings.some(text => text.includes('_computed.clientEndpoint'))).toBe(true);
    expect(bindings.some(text => text.includes('_computed.procNginx'))).toBe(true);
    expect(bindings.some(text => text.includes('_computed.archVm'))).toBe(true);
  });

  it('does not use unregistered Dl/Dt/Dd components', () => {
    const forbidden = walk(layout, node => ['Dl', 'Dt', 'Dd'].includes(String(node.name ?? '')));
    expect(forbidden).toBeNull();
  });
});
