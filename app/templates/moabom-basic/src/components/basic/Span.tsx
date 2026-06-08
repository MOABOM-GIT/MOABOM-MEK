import React from 'react';

export interface SpanProps extends React.HTMLAttributes<HTMLSpanElement> {}

/**
 * 기본 span 컴포넌트
 */
export const Span = React.forwardRef<HTMLSpanElement, SpanProps>(({
  children,
  className = '',
  ...props
}, ref) => {
  return (
    <span
      ref={ref}
      className={className}
      {...props}
    >
      {children}
    </span>
  );
});

Span.displayName = 'Span';
