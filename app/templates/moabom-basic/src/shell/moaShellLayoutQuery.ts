/** 셸 윈도우 layout 런타임용 URLSearchParams 파싱 (boardWindowLayoutRuntime 과 동일 규칙) */
export function parseQuery(search: string): Record<string, string | string[]> {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  const query: Record<string, string | string[]> = {};
  for (const key of params.keys()) {
    if (key in query) continue;
    const values = params.getAll(key);
    if (values.length > 1) {
      query[key] = values;
    } else if (values.length === 1) {
      query[key] = key.endsWith('[]') ? values : values[0];
    }
  }
  return query;
}
