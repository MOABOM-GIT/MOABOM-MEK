/**
 * G7 layout JSON을 앱 윈도우(컨테이너) 폭 기준으로 반응형 처리한다.
 * - JSON `responsive` 속성: 컨테이너 폭으로 선적용 후 `responsive` 제거 (DynamicRenderer 이중 적용 방지)
 * - Tailwind `sm:`/`md:`/`lg:`/`xl:` → `@sm:` 등 컨테이너 변형으로 치환 (`.moa-g7-window-host` 기준)
 * - G7 `Container`의 `py-*` 단독 래퍼는 제거 (앱 윈도우 본문에 불필요한 세로 패딩 div 방지)
 *
 * G7 코어 수정 없이 BoardWindowHost·향후 다른 G7 JSON 윈도우에서 공통 사용.
 */

export const MOA_G7_WINDOW_HOST_CLASS = 'moa-g7-window-host';

export type G7LayoutNode = {
  responsive?: Record<string, G7ResponsiveOverride>;
  props?: Record<string, unknown>;
  children?: G7LayoutNode[];
  default?: G7LayoutNode[];
  text?: string;
  if?: string;
  iteration?: unknown;
  [key: string]: unknown;
};

type G7ResponsiveOverride = {
  props?: Record<string, unknown>;
  children?: G7LayoutNode[];
  text?: string;
  if?: string;
  iteration?: unknown;
};

type ResponsiveManagerLike = {
  getMatchingKey: (responsive: Record<string, unknown>, width: number) => string | null;
};

const VIEWPORT_BREAKPOINT_PREFIX = /(^|\s)(sm|md|lg|xl):/g;
const VERTICAL_PADDING_CLASS = /^py-\d+$/;

function stripVerticalPaddingClasses(className: string): string {
  return className
    .trim()
    .split(/\s+/)
    .filter(token => token && !VERTICAL_PADDING_CLASS.test(token))
    .join(' ');
}

function mergeIfExpressions(parentIf?: string, childIf?: string): string | undefined {
  if (!parentIf) {
    return childIf;
  }
  if (!childIf) {
    return parentIf;
  }
  const parentExpr = parentIf.replace(/^\{\{|\}\}$/g, '').trim();
  const childExpr = childIf.replace(/^\{\{|\}\}$/g, '').trim();
  return `{{${parentExpr} && ${childExpr}}}`;
}

/** 윈도우 호스트에서 불필요한 Container 세로 패딩 래퍼를 벗긴다. */
function unwrapWindowPaddingContainer(node: G7LayoutNode): G7LayoutNode[] {
  if (node.name !== 'Container') {
    return [node];
  }

  const className = node.props?.className;
  if (typeof className !== 'string') {
    return [node];
  }

  const hasVerticalPadding = className.split(/\s+/).some(token => VERTICAL_PADDING_CLASS.test(token));
  if (!hasVerticalPadding) {
    return [node];
  }

  const strippedClassName = stripVerticalPaddingClasses(className);
  const nextProps = strippedClassName
    ? { ...node.props, className: strippedClassName }
    : (() => {
        const { className: _removed, ...rest } = node.props ?? {};
        return Object.keys(rest).length > 0 ? rest : undefined;
      })();

  if (strippedClassName === '' && (node.children?.length ?? 0) > 0) {
    return (node.children ?? []).map(child => ({
      ...child,
      if: mergeIfExpressions(node.if, child.if),
    }));
  }

  return [{ ...node, props: nextProps }];
}

function getResponsiveManager(): ResponsiveManagerLike | null {
  const manager = (window as { G7Core?: { ResponsiveManager?: ResponsiveManagerLike } }).G7Core
    ?.ResponsiveManager;
  return manager?.getMatchingKey ? manager : null;
}

/** Tailwind 뷰포트 breakpoint 접두사를 컨테이너 변형(`@sm:` 등)으로 바꾼다. */
export function rewriteViewportBreakpointPrefixes(className: string): string {
  if (!className || !VIEWPORT_BREAKPOINT_PREFIX.test(className)) {
    VIEWPORT_BREAKPOINT_PREFIX.lastIndex = 0;
    return className;
  }
  VIEWPORT_BREAKPOINT_PREFIX.lastIndex = 0;
  return className.replace(VIEWPORT_BREAKPOINT_PREFIX, '$1@$2:');
}

function rewritePropsForContainer(props: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!props) {
    return props;
  }
  const className = props.className;
  if (typeof className !== 'string') {
    return props;
  }
  const next = rewriteViewportBreakpointPrefixes(className);
  if (next === className) {
    return props;
  }
  return { ...props, className: next };
}

function mergeResponsiveOverride(node: G7LayoutNode, override: G7ResponsiveOverride): G7LayoutNode {
  return {
    ...node,
    props: { ...node.props, ...override.props },
    children: override.children ?? node.children,
    text: override.text ?? node.text,
    if: override.if ?? node.if,
    iteration: override.iteration ?? node.iteration,
  };
}

function adaptG7LayoutNode(node: G7LayoutNode, containerWidth: number): G7LayoutNode[] {
  let next: G7LayoutNode = { ...node };

  if (next.responsive) {
    const manager = getResponsiveManager();
    const matchedKey = manager?.getMatchingKey(next.responsive, containerWidth) ?? null;
    if (matchedKey) {
      next = mergeResponsiveOverride(next, next.responsive[matchedKey] ?? {});
    }
    const { responsive: _removed, ...withoutResponsive } = next;
    next = withoutResponsive;
  }

  if (next.props) {
    next = { ...next, props: rewritePropsForContainer(next.props) };
  }

  if (next.children?.length) {
    next = {
      ...next,
      children: next.children.flatMap(child => adaptG7LayoutNode(child, containerWidth)),
    };
  }

  if (next.default?.length) {
    next = {
      ...next,
      default: next.default.flatMap(child => adaptG7LayoutNode(child, containerWidth)),
    };
  }

  return unwrapWindowPaddingContainer(next);
}

/** G7 component 트리 루트 배열을 컨테이너 폭에 맞게 변환한다. */
export function adaptG7LayoutTreeForContainerWidth<T extends G7LayoutNode>(
  roots: T[],
  containerWidth: number,
): T[] {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return roots;
  }
  return roots.flatMap(root => adaptG7LayoutNode(root, containerWidth) as T[]);
}
