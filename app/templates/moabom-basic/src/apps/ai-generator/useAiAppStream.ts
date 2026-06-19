import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cancelAiGenerationSession,
  cancelStreamingAiGenerationSession,
  fetchActiveAiGenerationSession,
  streamAiApp,
  type AiAppType,
  type StreamAiAppDonePayload,
} from '../../api/moabomAppsApi';

interface UseAiAppStreamOptions {
  appType: AiAppType;
  modelId: string;
  generatedAppId?: number | null;
  onDone?: (result: StreamAiAppDonePayload) => void;
}

export function useAiAppStream({
  appType,
  modelId,
  generatedAppId,
  onDone,
}: UseAiAppStreamOptions) {
  const [streamedRaw, setStreamedRaw] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [resumeSession, setResumeSession] = useState<Awaited<ReturnType<typeof fetchActiveAiGenerationSession>>>(null);
  const [resumeChecked, setResumeChecked] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<number | null>(null);
  const preStreamRawRef = useRef('');
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const session = await fetchActiveAiGenerationSession();
        if (!cancelled) {
          setResumeSession(session);
        }
      } catch {
        if (!cancelled) {
          setResumeSession(null);
        }
      } finally {
        if (!cancelled) {
          setResumeChecked(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const streamedRawRef = useRef('');
  streamedRawRef.current = streamedRaw;

  const runStream = useCallback(async (options: {
    prompt: string;
    currentHtml?: string | null;
    continueGeneration?: boolean;
    generationMode?: 'generate' | 'append' | 'patch';
    existingSessionId?: number | null;
  }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const initialAccumulated = options.continueGeneration ? streamedRawRef.current : '';
    preStreamRawRef.current = options.continueGeneration ? streamedRawRef.current : '';

    setIsStreaming(true);
    setTruncated(false);
    if (!options.continueGeneration) {
      setStreamedRaw('');
    }

    try {
      const result = await streamAiApp(
        {
          prompt: options.prompt,
          app_type: appType,
          model_id: modelId,
          current_html: options.currentHtml ?? null,
          continue: options.continueGeneration ?? false,
          generation_mode: options.generationMode ?? (options.continueGeneration ? 'append' : (options.currentHtml ? 'patch' : 'generate')),
          session_id: options.existingSessionId ?? sessionId,
          generated_app_id: generatedAppId ?? null,
        },
        {
          onSession: (id) => {
            sessionIdRef.current = id;
            setSessionId(id);
          },
          onDelta: (_text, accumulated) => {
            setStreamedRaw(accumulated);
          },
          onDone: (payload) => {
            if (payload.session_id) {
              sessionIdRef.current = payload.session_id;
              setSessionId(payload.session_id);
            }
            if (payload.html) {
              setStreamedRaw(payload.html);
            }
            setTruncated(Boolean(payload.truncated));
            onDoneRef.current?.(payload);
          },
        },
        controller.signal,
        initialAccumulated,
      );

      return result;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null;
      }
      throw err;
    } finally {
      setIsStreaming(false);
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [appType, generatedAppId, modelId, sessionId]);

  const stopGeneration = useCallback(async () => {
    const id = sessionIdRef.current;

    try {
      if (id) {
        await cancelAiGenerationSession(id);
      } else {
        await cancelStreamingAiGenerationSession();
      }
    } catch {
      // 연결이 끊긴 뒤에도 서버가 정리할 수 있도록 abort는 계속 진행한다.
    }

    abortRef.current?.abort();
    abortRef.current = null;

    setIsStreaming(false);
    setSessionId(null);
    sessionIdRef.current = null;
    setTruncated(false);
    setStreamedRaw(preStreamRawRef.current);
    setResumeSession(null);
  }, []);

  const adoptResumeSession = useCallback(() => {
    if (!resumeSession?.partial_raw) {
      return;
    }
    setSessionId(resumeSession.id);
    sessionIdRef.current = resumeSession.id;
    setStreamedRaw(resumeSession.partial_raw);
    setTruncated(Boolean(resumeSession.truncated));
    setResumeSession(null);
  }, [resumeSession]);

  const dismissResumeSession = useCallback(() => {
    setResumeSession(null);
  }, []);

  return {
    streamedRaw,
    isStreaming,
    sessionId,
    truncated,
    resumeSession,
    resumeChecked,
    runStream,
    stopGeneration,
    adoptResumeSession,
    dismissResumeSession,
    setStreamedRaw,
    setSessionId,
  };
}
