import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const layoutPath = path.resolve(
  __dirname,
  '../../../../../../modules/moabom-system/resources/layouts/admin/admin_mypage_settings.json',
);

const layout = JSON.parse(readFileSync(layoutPath, 'utf8'));

function walk(node: any, predicate: (node: any) => boolean): any | null {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;

  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    const found = walk(child, predicate);
    if (found) return found;
  }

  const slots = node.slots && typeof node.slots === 'object' ? Object.values(node.slots).flat() : [];
  for (const child of slots) {
    const found = walk(child, predicate);
    if (found) return found;
  }

  return null;
}

describe('admin_mypage_settings layout', () => {
  it('포인트 컬러 input은 배열 인덱스 자동 바인딩 대신 배열 전체를 명시 갱신해야 함', () => {
    const colorInput = walk(
      layout,
      node => node.name === 'Input' && node.props?.type === 'color' && String(node.props?.name ?? '').includes('point_color_presets'),
    );

    expect(colorInput).toBeTruthy();
    expect(colorInput.props.autoBinding).toBe(false);
    expect(colorInput.actions?.[0]?.event).toBe('onChange');
    expect(colorInput.actions?.[0]?.params?.['form.appearance.point_color_presets']).toContain('.map((color, i)');
    expect(colorInput.actions?.[0]?.params?.['form.appearance.point_color_presets']).toContain('$event.target.value');
  });

  it('색상 추가 버튼은 point_color_presets가 배열일 때만 기존 값을 spread 해야 함', () => {
    const addButton = walk(
      layout,
      node => node.name === 'Button'
        && node.actions?.[0]?.params?.['form.appearance.point_color_presets']
        && String(node.actions[0].params['form.appearance.point_color_presets']).includes("'#6366f1'"),
    );

    const expression = addButton?.actions?.[0]?.params?.['form.appearance.point_color_presets'];
    expect(expression).toBeTruthy();
    expect(expression).toContain('Array.isArray(_local.form?.appearance?.point_color_presets)');
  });
});
