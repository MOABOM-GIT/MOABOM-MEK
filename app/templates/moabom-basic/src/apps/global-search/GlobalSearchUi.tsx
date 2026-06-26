import type { ReactNode } from 'react';
import { Span } from '../../components/basic/Span';

/** 검색어 일치 구간을 강조 표시한다. */
export function HighlightText({
  text,
  query,
  highlightedHtml,
}: {
  text: string;
  query: string;
  highlightedHtml?: string;
}) {
  if (highlightedHtml) {
    return (
      <Span
        className="moa-global-search-highlight"
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      />
    );
  }

  const q = query.trim().toLowerCase();
  if (!q) {
    return <Span>{text}</Span>;
  }

  const lower = text.toLowerCase();
  const index = lower.indexOf(q);
  if (index < 0) {
    return <Span>{text}</Span>;
  }

  const before = text.slice(0, index);
  const match = text.slice(index, index + q.length);
  const after = text.slice(index + q.length);

  return (
    <Span>
      {before}
      <mark className="moa-global-search-mark">{match}</mark>
      {after}
    </Span>
  );
}

export function SearchResultRow({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="moa-global-search-result" onClick={onClick}>
      {children}
    </button>
  );
}

export function SearchSection({
  title,
  emptyLabel,
  hasItems,
  children,
}: {
  title: string;
  emptyLabel: string;
  hasItems: boolean;
  children: ReactNode;
}) {
  return (
    <section className="moa-global-search-section">
      <h3 className="moa-global-search-section__title">{title}</h3>
      {hasItems ? (
        <div className="moa-global-search-section__list">{children}</div>
      ) : (
        <p className="moa-global-search-section__empty">{emptyLabel}</p>
      )}
    </section>
  );
}
