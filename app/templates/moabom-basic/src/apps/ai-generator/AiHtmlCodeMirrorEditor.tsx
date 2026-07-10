import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { html } from '@codemirror/lang-html';
import { Div } from '../../components/basic/Div';

export interface AiHtmlCodeMirrorEditorProps {
  value: string;
  onChange: (next: string) => void;
  onBlurCommit?: () => void;
  ariaLabel: string;
  className?: string;
}

/**
 * 비스트리밍·직접 입력용 경량 HTML 에디터.
 * 최종 값은 기존 Textarea와 동일하게 HTML 문자열이다.
 */
export function AiHtmlCodeMirrorEditor({
  value,
  onChange,
  onBlurCommit,
  ariaLabel,
  className = '',
}: AiHtmlCodeMirrorEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onBlurCommitRef = useRef(onBlurCommit);
  onChangeRef.current = onChange;
  onBlurCommitRef.current = onBlurCommit;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || viewRef.current) {
      return;
    }

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          history(),
          html(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
          EditorView.domEventHandlers({
            blur: () => {
              onBlurCommitRef.current?.();
              return false;
            },
          }),
          EditorView.theme({
            '&': {
              height: '100%',
              fontSize: '12px',
            },
            '.cm-scroller': {
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              lineHeight: '1.55',
            },
            '.cm-content': {
              padding: '12px 0',
            },
            '&.cm-focused': {
              outline: 'none',
            },
          }),
        ],
      }),
    });

    view.dom.setAttribute('aria-label', ariaLabel);
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // 마운트 시 1회만 생성. value 동기화는 아래 effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const current = view.state.doc.toString();
    if (current === value) {
      return;
    }
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  useEffect(() => {
    viewRef.current?.dom.setAttribute('aria-label', ariaLabel);
  }, [ariaLabel]);

  return (
    <Div
      ref={hostRef}
      className={`moa-ai-codemirror min-h-0 flex-1 overflow-hidden rounded-2xl bg-black/5 dark:bg-white/5 ${className}`.trim()}
    />
  );
}
