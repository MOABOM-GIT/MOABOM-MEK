export type StateRecord = Record<string, any>;

export function isPlainObject(value: unknown): value is StateRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function isNonPlainObject(value: unknown): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !isPlainObject(value);
}

export function hasOnlyNumericKeys(obj: StateRecord): boolean {
  const keys = Object.keys(obj);
  return keys.length > 0 && keys.every((key) => /^\d+$/.test(key));
}

interface DeepMergeStateOptions {
  replaceOnlyKeys?: string[];
}

export function deepMergeStateSafe(
  target: StateRecord,
  source: StateRecord,
  options: DeepMergeStateOptions = {}
): StateRecord {
  const replaceOnlyKeys = options.replaceOnlyKeys ?? [];

  if (Array.isArray(target) && isPlainObject(source) && hasOnlyNumericKeys(source)) {
    const numericKeys = Object.keys(source).map((key) => parseInt(key, 10));
    const maxKey = numericKeys.length > 0 ? Math.max(...numericKeys) : 0;

    if (maxKey < target.length + numericKeys.length + 10) {
      const result = [...target];
      for (const [sourceKey, sourceValue] of Object.entries(source)) {
        const index = parseInt(sourceKey, 10);
        if (index >= 0 && index < result.length) {
          const targetValue = result[index];
          result[index] = isPlainObject(sourceValue) && isPlainObject(targetValue)
            ? deepMergeStateSafe(targetValue, sourceValue, options)
            : sourceValue;
        } else if (index >= result.length) {
          result[index] = sourceValue;
        }
      }

      return result as unknown as StateRecord;
    }
  }

  const result: StateRecord = { ...target };

  for (const [key, sourceValue] of Object.entries(source)) {
    const targetValue = target?.[key];

    if (replaceOnlyKeys.includes(key) || sourceValue === null || Array.isArray(sourceValue)) {
      result[key] = sourceValue;
      continue;
    }

    if (isNonPlainObject(sourceValue)) {
      result[key] = sourceValue;
      continue;
    }

    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      result[key] = deepMergeStateSafe(targetValue, sourceValue, options);
      continue;
    }

    result[key] = sourceValue;
  }

  return result;
}
