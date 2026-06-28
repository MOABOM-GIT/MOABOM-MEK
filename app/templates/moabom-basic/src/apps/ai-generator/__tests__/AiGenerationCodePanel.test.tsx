import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AiGenerationCodePanel } from '../AiGenerationCodePanel';

const t = (key: string) => key;

describe('AiGenerationCodePanel', () => {
  it('스트리밍 중에는 읽기 전용 미리보기를 표시한다', () => {
    const { container } = render(
      <AiGenerationCodePanel
        isStreaming
        codePreview="<div>live</div>"
        editableCode=""
        completeness="partial"
        onCodeChange={vi.fn()}
        codePanelRef={{ current: null }}
        t={t}
      />,
    );

    expect(screen.getByText('moa_apps_ai.stream_title_loading')).toBeInTheDocument();
    expect(container.querySelector('textarea')).not.toBeInTheDocument();
    expect(screen.getByText('<div>live</div>')).toBeInTheDocument();
  });

  it('생성 완료 후에는 textarea로 코드를 편집할 수 있다', async () => {
    const user = userEvent.setup();
    const onCodeChange = vi.fn();

    render(
      <AiGenerationCodePanel
        isStreaming={false}
        codePreview="<html>ok</html>"
        editableCode="<html>ok</html>"
        completeness="complete"
        onCodeChange={onCodeChange}
        codePanelRef={{ current: null }}
        t={t}
      />,
    );

    const textarea = screen.getByLabelText('moa_apps_ai.stream_title_editable');
    expect(textarea).toBeInTheDocument();
    await user.clear(textarea);
    await user.type(textarea, 'x');

    expect(onCodeChange).toHaveBeenCalled();
    expect(onCodeChange.mock.calls.at(-1)?.[0]).toContain('x');
  });

  it('blur 시 onCodeCommit을 호출한다', async () => {
    const user = userEvent.setup();
    const onCodeCommit = vi.fn();

    render(
      <AiGenerationCodePanel
        isStreaming={false}
        codePreview="<html>ok</html>"
        editableCode="<html>ok</html>"
        completeness="complete"
        onCodeChange={vi.fn()}
        onCodeCommit={onCodeCommit}
        codePanelRef={{ current: null }}
        t={t}
      />,
    );

    const textarea = screen.getByLabelText('moa_apps_ai.stream_title_editable');
    await user.click(textarea);
    await user.tab();

    expect(onCodeCommit).toHaveBeenCalled();
  });
});
