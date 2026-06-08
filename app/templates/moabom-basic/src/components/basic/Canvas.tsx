import React from 'react';

export interface CanvasProps extends React.CanvasHTMLAttributes<HTMLCanvasElement> {
  ref?: React.Ref<HTMLCanvasElement>;
}

/**
 * 기본 canvas 컴포넌트
 */
export const Canvas = React.forwardRef<HTMLCanvasElement, CanvasProps>(({
  className = '',
  ...props
}, ref) => {
  return (
    <canvas
      ref={ref}
      className={className}
      {...props}
    />
  );
});

Canvas.displayName = 'Canvas';
