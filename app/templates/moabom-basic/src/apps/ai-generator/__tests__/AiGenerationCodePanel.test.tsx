import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiGenerationCodePanel } from '../AiGenerationCodePanel';

const t = (key: string) => key;

vi.mock('../AiHtmlCodeMirrorEditor', () => ({
  AiHtmlCodeMirrorEditor: ({
    value,
    onChange,
    onBlurCommit,
    ariaLabel,
  }: {
    value: string;
    onChange: (next: string) => void;
    onBlurCommit?: () => void;
    ariaLabel: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => onBlurCommit?.()}
    />
  ),
}));

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

  it('생성 완료 후에는 에디터로 코드를 편집할 수 있다', async () => {
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

    const editor = screen.getByLabelText('moa_apps_ai.stream_title_editable');
    expect(editor).toBeInTheDocument();
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    (editor as HTMLTextAreaElement).value = 'x';
    editor.dispatchEvent(new Event('change', { bubbles: true }));
  });

  it('pasteMode에서는 빈 코드도 에디터를 표시한다', () => {
    render(
      <AiGenerationCodePanel
        isStreaming={false}
        codePreview=""
        editableCode=""
        completeness="empty"
        onCodeChange={vi.fn()}
        codePanelRef={{ current: null }}
        t={t}
        pasteMode
      />,
    );

    expect(screen.getByText('moa_apps_ai.stream_title_paste')).toBeInTheDocument();
    expect(screen.getByLabelText('moa_apps_ai.stream_title_paste')).toBeInTheDocument();
  });

  it('blur 시 onCodeCommit을 호출한다', () => {
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

    const editor = screen.getByLabelText('moa_apps_ai.stream_title_editable');
    editor.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    expect(onCodeCommit).toHaveBeenCalled();
  });

  it('휴지통 클릭 시 코드를 비운다', () => {
    const onCodeChange = vi.fn();
    const onCodeCommit = vi.fn();

    render(
      <AiGenerationCodePanel
        isStreaming={false}
        codePreview="<html>ok</html>"
        editableCode="<html>ok</html>"
        completeness="complete"
        onCodeChange={onCodeChange}
        onCodeCommit={onCodeCommit}
        codePanelRef={{ current: null }}
        t={t}
      />,
    );

    screen.getByRole('button', { name: 'moa_apps_ai.clear_code' }).click();
    expect(onCodeChange).toHaveBeenCalledWith('');
    expect(onCodeCommit).toHaveBeenCalled();
  });
});
