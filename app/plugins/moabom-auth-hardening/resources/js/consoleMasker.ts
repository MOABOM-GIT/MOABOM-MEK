const MASKED = '[MOABOM_MASKED]';

const SENSITIVE_KEY_PATTERN =
    /(password|passwd|pwd|token|access[_-]?token|refresh[_-]?token|authorization|secret|api[_-]?key|credential|session|cookie|email|phone|mobile|tel)/i;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /\b(?:\+?\d[\d\s.-]{7,}\d)\b/g;
const AUTH_BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/g;
const KEY_VALUE_PATTERN =
    /\b(password|passwd|pwd|token|access[_-]?token|refresh[_-]?token|authorization|secret|api[_-]?key|credential|session|cookie|email|phone|mobile|tel)\b\s*[:=]\s*(['"]?)[^'",\s}]+/gi;

type ConsoleMethod = 'debug' | 'error' | 'info' | 'log' | 'table' | 'trace' | 'warn';
type ConsoleFn = (...args: unknown[]) => void;

const METHODS: ConsoleMethod[] = ['debug', 'error', 'info', 'log', 'table', 'trace', 'warn'];

const originals = new Map<ConsoleMethod, ConsoleFn>();
let installed = false;

function maskString(value: string): string {
    return value
        .replace(AUTH_BEARER_PATTERN, `Bearer ${MASKED}`)
        .replace(KEY_VALUE_PATTERN, (_match, key: string, quote: string) => `${key}: ${quote}${MASKED}`)
        .replace(EMAIL_PATTERN, MASKED)
        .replace(PHONE_PATTERN, MASKED);
}

function maskValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
    if (typeof value === 'string') {
        return maskString(value);
    }

    if (value === null || typeof value !== 'object') {
        return value;
    }

    if (value instanceof Error) {
        const error = new Error(maskString(value.message));
        error.name = value.name;
        error.stack = value.stack ? maskString(value.stack) : value.stack;
        return error;
    }

    if (value instanceof Element || value instanceof Event) {
        return value;
    }

    if (depth >= 4 || seen.has(value)) {
        return '[Circular]';
    }

    seen.add(value);

    if (Array.isArray(value)) {
        return value.map(item => maskValue(item, depth + 1, seen));
    }

    const source = value as Record<string, unknown>;
    const copy: Record<string, unknown> = {};

    Object.entries(source).forEach(([key, item]) => {
        copy[key] = SENSITIVE_KEY_PATTERN.test(key) ? MASKED : maskValue(item, depth + 1, seen);
    });

    return copy;
}

export function installConsoleMasker(): void {
    if (installed) return;

    METHODS.forEach(method => {
        const original = console[method] as ConsoleFn | undefined;
        if (typeof original !== 'function') return;

        originals.set(method, original.bind(console));
        console[method] = ((...args: unknown[]) => {
            const maskedArgs = args.map(arg => maskValue(arg));
            originals.get(method)?.(...maskedArgs);
        }) as typeof console[typeof method];
    });

    installed = true;
}

export function __resetConsoleMaskerForTest(): void {
    originals.forEach((original, method) => {
        console[method] = original as typeof console[typeof method];
    });
    originals.clear();
    installed = false;
}
