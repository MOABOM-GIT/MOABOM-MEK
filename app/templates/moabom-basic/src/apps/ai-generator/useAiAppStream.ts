import { useCallback, useEffect, useRef, useState } from 'react';
import {
  claimAiGenerationBusy,
  releaseAiGenerationBusy,
} from 'moabom-ai-generation-activity';
import {
  cancelAiGenerationSession,
  cancelAiGenerationQueue,
  cancelStreamingAiGenerationSession,
  fetchActiveAiGenerationSession,
  streamAiApp,
  type AiAppType,
  type AiGenerationQueueState,
  type AppTier,
} from '../../api/moabomAppsApi';
import {
  buildGenerationDraftView,
  inferPhaseFromFinalize,
  type GenerationDraftFinalize,
  type GenerationPhase,
} from './aiGenerationDraft';

interface UseAiAppStreamOptions {
  appType: AiAppType;
  appTier?: AppTier;
  modelId: string;
  generatedAppId?: number | null;
  onDraftFinalize?: (draft: GenerationDraftFinalize) => void;
}

export function useAiAppStream({
  appType,
  appTier = 'standard',
  modelId,
  generatedAppId,
  onDraftFinalize,
}: UseAiAppStreamOptions) {
  const [streamedRaw, setStreamedRaw] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>('idle');
  const [resumeSession, setResumeSession] = useState<Awaited<ReturnType<typeof fetchActiveAiGenerationSession>>>(null);
  const [resumeChecked, setResumeChecked] = useState(false);
  const [queueState, setQueueState] = useState<AiGenerationQueueState | null>(null);
  const queueTicketRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<number | null>(null);
  const busyOwnerRef = useRef(Symbol('ai-generation-busy'));
  const preStreamRawRef = useRef('');
  const onDraftFinalizeRef = useRef(onDraftFinalize);
  onDraftFinalizeRef.current = onDraftFinalize;

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    if (isStreaming || queueState !== null) {
      claimAiGenerationBusy(busyOwnerRef.current);
      return;
    }
    releaseAiGenerationBusy(busyOwnerRef.current);
  }, [isStreaming, queueState]);

  useEffect(() => () => {
    // 강제 언마운트 시에만 중단·해제. 백그라운드 최소화는 마운트 유지로 cleanup이 돌지 않는다.
    abortRef.current?.abort();
    abortRef.current = null;
    releaseAiGenerationBusy(busyOwnerRef.current);
  }, []);

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

  const finalizeDraft = useCallback((draft: GenerationDraftFinalize) => {
    const phase = inferPhaseFromFinalize(draft, false, false);
    setGenerationPhase(phase);
    onDraftFinalizeRef.current?.(draft);
  }, []);

  const runStream = useCallback(async (options: {
    prompt: string;
    title?: string;
    currentHtml?: string | null;
    continueGeneration?: boolean;
    generationMode?: 'generate' | 'append' | 'patch';
    existingSessionId?: number | null;
  }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const initialAccumulated = options.continueGeneration
      ? (streamedRawRef.current.trim() || (options.currentHtml ?? '').trim())
      : '';
    preStreamRawRef.current = initialAccumulated;

    // 최소화/닫기 분기가 useEffect 이전 tick에 돌면 busy=false로 언마운트·abort 되므로 동기 claim.
    claimAiGenerationBusy(busyOwnerRef.current);
    setIsStreaming(true);
    setGenerationPhase(queueState ? 'queued' : 'streaming');
    setQueueState(null);
    queueTicketRef.current = null;
    if (!options.continueGeneration) {
      setStreamedRaw('');
    } else if (initialAccumulated && !streamedRawRef.current.trim()) {
      // finalize 후 버퍼가 비었을 때 current_html/세션 원문으로 접두를 복구
      setStreamedRaw(initialAccumulated);
      streamedRawRef.current = initialAccumulated;
    }

    try {
      const result = await streamAiApp(
        {
          prompt: options.prompt,
          title: options.title?.trim() || null,
          app_type: appType,
          tier: appTier,
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
            setQueueState(null);
            queueTicketRef.current = null;
            setGenerationPhase('streaming');
          },
          onDelta: (_text, accumulated) => {
            setQueueState(null);
            setStreamedRaw(accumulated);
            setGenerationPhase('streaming');
          },
          onQueueUpdate: (queue) => {
            queueTicketRef.current = queue.ticketId || queueTicketRef.current;
            setQueueState(queue);
            setGenerationPhase('queued');
          },
          onDone: (payload) => {
            if (payload.session_id) {
              sessionIdRef.current = payload.session_id;
              setSessionId(payload.session_id);
            }

            // truncated 시 html이 비고 delta만 suffix일 수 있음 → raw(서버 병합본) 우선
            const finalSource = (
              payload.html
              || payload.raw
              || streamedRawRef.current
              || ''
            ).trim();
            if (finalSource) {
              setStreamedRaw(finalSource);
              streamedRawRef.current = finalSource;
            }

            finalizeDraft({
              source: finalSource,
              truncated: Boolean(payload.truncated),
              finishReason: payload.finish_reason ?? null,
              notice: payload.notice ?? null,
              fallback: payload.fallback ?? false,
            });
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

      const partial = streamedRawRef.current.trim();
      if (partial) {
        finalizeDraft({
          source: partial,
          truncated: buildGenerationDraftView(partial).completeness === 'partial',
          finishReason: 'error',
        });
      } else {
        setGenerationPhase('failed');
      }
      throw err;
    } finally {
      setIsStreaming(false);
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [appTier, appType, finalizeDraft, generatedAppId, modelId, queueState, sessionId]);

  const stopGeneration = useCallback(async () => {
    const id = sessionIdRef.current;
    const queueTicket = queueTicketRef.current;
    const partial = streamedRawRef.current.trim();

    try {
      if (queueTicket) {
        await cancelAiGenerationQueue(queueTicket);
      } else if (id) {
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
    setQueueState(null);
    queueTicketRef.current = null;

    if (partial) {
      setStreamedRaw(partial);
      finalizeDraft({
        source: partial,
        truncated: buildGenerationDraftView(partial).completeness === 'partial',
        finishReason: 'cancelled',
      });
      return;
    }

    setSessionId(null);
    sessionIdRef.current = null;
    setGenerationPhase('idle');
    setStreamedRaw(preStreamRawRef.current);
    setResumeSession(null);
  }, [finalizeDraft]);

  const adoptResumeSession = useCallback(() => {
    if (!resumeSession?.partial_raw) {
      return;
    }
    setSessionId(resumeSession.id);
    sessionIdRef.current = resumeSession.id;
    setStreamedRaw(resumeSession.partial_raw);
    finalizeDraft({
      source: resumeSession.partial_raw,
      truncated: Boolean(resumeSession.truncated),
      finishReason: resumeSession.truncated ? 'max_tokens' : 'cancelled',
    });
    setResumeSession(null);
  }, [finalizeDraft, resumeSession]);

  const dismissResumeSession = useCallback(() => {
    setResumeSession(null);
  }, []);

  const cancelQueue = useCallback(async () => {
    await stopGeneration();
  }, [stopGeneration]);

  const clearStreamedBuffer = useCallback(() => {
    setStreamedRaw('');
  }, []);

  return {
    streamedRaw,
    isStreaming,
    isQueued: queueState !== null,
    queueState,
    generationPhase,
    sessionId,
    resumeSession,
    resumeChecked,
    runStream,
    stopGeneration,
    cancelQueue,
    adoptResumeSession,
    dismissResumeSession,
    setStreamedRaw,
    clearStreamedBuffer,
    setSessionId,
  };
}
