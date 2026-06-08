import type { MoabomSystemState } from '../types/moabomSystem';

/** pull·저장 이벤트 연쇄를 막기 위한 얕은 동등 비교 */
export function areMoabomSystemStatesEqual(a: MoabomSystemState, b: MoabomSystemState): boolean {
  if (a.version !== b.version) {
    return false;
  }
  if (a.preferences.language !== b.preferences.language) {
    return false;
  }

  try {
    return (
      JSON.stringify(a.layout) === JSON.stringify(b.layout)
      && JSON.stringify(a.appearance) === JSON.stringify(b.appearance)
      && JSON.stringify(a.preferences.systemOptions) === JSON.stringify(b.preferences.systemOptions)
    );
  } catch {
    return false;
  }
}
