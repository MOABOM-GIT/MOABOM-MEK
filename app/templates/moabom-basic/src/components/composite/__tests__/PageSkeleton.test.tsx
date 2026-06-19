import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageSkeleton } from '../PageSkeleton';

describe('PageSkeleton', () => {
  it('renders the shared circular loading indicator instead of layout skeleton blocks', () => {
    render(
      <PageSkeleton
        components={[{ type: 'basic', name: 'Div' }]}
        options={{ animation: 'pulse', iteration_count: 3 }}
      />,
    );

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status.querySelector('[style*="moabom-loading-spin"]')).toBeTruthy();
    expect(status.querySelector('.animate-pulse')).toBeNull();
  });
});
