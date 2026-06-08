const GUARDED_MARKER = 'data-moa-xss-guarded';
const URL_ATTRIBUTES = ['action', 'formaction', 'href', 'src', 'xlink:href'];

function isUnsafeUrl(value: string): boolean {
    const normalized = value.replace(/[\u0000-\u001F\u007F\s]+/g, '').toLowerCase();
    return normalized.startsWith('javascript:') || normalized.startsWith('data:text/html');
}

/** observer 가 반응해야 하는 속성 변경인지 (가드 마커·class 등 일반 속성은 제외) */
function isSecurityRelevantAttribute(attrName: string | null): boolean {
    if (!attrName) {
        return false;
    }
    const lower = attrName.toLowerCase();
    if (lower === GUARDED_MARKER) {
        return false;
    }
    if (lower.startsWith('on')) {
        return true;
    }
    return URL_ATTRIBUTES.includes(lower);
}

function sanitizeElement(element: Element): void {
    if (element.getAttribute(GUARDED_MARKER) === '1') return;

    Array.from(element.attributes).forEach(attribute => {
        const name = attribute.name.toLowerCase();

        if (name.startsWith('on')) {
            element.removeAttribute(attribute.name);
            return;
        }

        if (URL_ATTRIBUTES.includes(name) && isUnsafeUrl(attribute.value)) {
            element.removeAttribute(attribute.name);
        }
    });

    element.setAttribute(GUARDED_MARKER, '1');
}

function sanitizeTree(root: ParentNode): void {
    if (root instanceof Element) {
        sanitizeElement(root);
    }

    root.querySelectorAll('*').forEach(sanitizeElement);
}

let observer: MutationObserver | null = null;

export function installDomXssGuard(): void {
    if (observer) return;

    sanitizeTree(document);

    observer = new MutationObserver(records => {
        records.forEach(record => {
            if (record.type === 'attributes' && record.target instanceof Element) {
                if (!isSecurityRelevantAttribute(record.attributeName)) {
                    return;
                }
                record.target.removeAttribute(GUARDED_MARKER);
                sanitizeElement(record.target);
                return;
            }

            record.addedNodes.forEach(node => {
                if (node instanceof Element) {
                    sanitizeTree(node);
                }
            });
        });
    });

    observer.observe(document.documentElement, {
        attributes: true,
        childList: true,
        subtree: true,
    });
}

export function __resetDomXssGuardForTest(): void {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
}
