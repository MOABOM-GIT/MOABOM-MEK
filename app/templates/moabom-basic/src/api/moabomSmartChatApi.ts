import {
  assertShellAccessToken,
  createShellModuleApi,
  MoabomShellAuthRequiredError,
  MoabomShellModuleApiError,
} from './moabomShellHttp';

const request = createShellModuleApi('moabom-smart-chat');

export interface SmartChatModel {
  id: string;
  provider: string;
  model: string;
  label?: string;
}

export interface SmartChatConversation {
  uuid: string;
  title: string | null;
  model_id: string;
  folder_uuid?: string | null;
  share?: {
    enabled: boolean;
    share_token?: string | null;
    share_path?: string | null;
    share_url?: string | null;
    share_enabled_at?: string | null;
  };
  last_message_at?: string | null;
  updated_at?: string | null;
}

export interface SmartChatMessage {
  id: number;
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
  status: string;
  model_id?: string | null;
  parent_id?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  created_at?: string | null;
}

export interface SmartChatFolder {
  uuid: string;
  name: string;
  sort_order: number;
}

export interface SmartChatMemory {
  uuid: string;
  content: string;
  created_at?: string | null;
}

export interface SmartChatAttachment {
  uuid: string;
  original_name: string;
  mime: string;
  kind: 'image' | 'document' | string;
  size_bytes: number;
  has_extracted_text?: boolean;
}

export interface SmartChatPreferences {
  custom_instructions: string;
  enabled_tools: string[];
  web_search_enabled: boolean;
}

export interface SmartChatGeneratedAppOption {
  id: number;
  title: string;
  app_type: string | null;
}

export interface StreamSmartChatOptions {
  attachmentUuids?: string[];
  parentId?: number | null;
  generatedAppId?: number | null;
  tools?: string[];
  webSearch?: boolean;
}

export async function fetchSmartChatModels(): Promise<{
  models: SmartChatModel[];
  default_model_id: string;
}> {
  return request('models');
}

export async function fetchSmartChatPreferences(): Promise<SmartChatPreferences> {
  const data = await request<Partial<SmartChatPreferences>>('preferences');
  return {
    custom_instructions: data.custom_instructions ?? '',
    enabled_tools: Array.isArray(data.enabled_tools) ? data.enabled_tools : ['weather', 'profile'],
    web_search_enabled: Boolean(data.web_search_enabled),
  };
}

export async function saveSmartChatPreferences(
  payload: Partial<SmartChatPreferences>,
): Promise<SmartChatPreferences> {
  const data = await request<Partial<SmartChatPreferences>>('preferences', {
    method: 'PUT',
    body: payload,
  });
  return {
    custom_instructions: data.custom_instructions ?? '',
    enabled_tools: Array.isArray(data.enabled_tools) ? data.enabled_tools : [],
    web_search_enabled: Boolean(data.web_search_enabled),
  };
}

/** "이 답으로 앱 만들기" — 질문+답변을 앱 제목·제작 프롬프트로 요약 (백엔드 LLM). */
export async function buildSmartChatHandoffPrompt(
  question: string,
  answer: string,
): Promise<{ title: string; prompt: string }> {
  const data = await request<{ title?: string; prompt?: string }>('handoff-prompt', {
    method: 'POST',
    body: { question, answer },
  });
  return {
    title: typeof data.title === 'string' ? data.title.trim() : '',
    prompt: typeof data.prompt === 'string' ? data.prompt : '',
  };
}

export async function fetchSmartChatGeneratedApps(): Promise<SmartChatGeneratedAppOption[]> {
  const data = await request<{ apps: SmartChatGeneratedAppOption[] }>('generated-apps');
  return data.apps ?? [];
}

export async function uploadSmartChatAttachment(
  file: File,
  conversationUuid?: string | null,
): Promise<SmartChatAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  if (conversationUuid) {
    formData.append('conversation_uuid', conversationUuid);
  }
  const data = await request<{ attachment: SmartChatAttachment }>('attachments', {
    method: 'POST',
    body: formData,
  });
  return data.attachment;
}

export async function fetchSmartChatConversations(
  limit = 50,
  folderUuid?: string | null,
): Promise<SmartChatConversation[]> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (folderUuid) qs.set('folder_uuid', folderUuid);
  const data = await request<{ conversations: SmartChatConversation[] }>(
    `conversations?${qs.toString()}`,
  );
  return data.conversations ?? [];
}

export async function createSmartChatConversation(
  modelId?: string,
  folderUuid?: string | null,
): Promise<SmartChatConversation> {
  const data = await request<{ conversation: SmartChatConversation }>('conversations', {
    method: 'POST',
    body: {
      ...(modelId ? { model_id: modelId } : {}),
      ...(folderUuid ? { folder_uuid: folderUuid } : {}),
    },
  });
  return data.conversation;
}

export async function updateSmartChatConversation(
  uuid: string,
  payload: { folder_uuid?: string | null; title?: string },
): Promise<SmartChatConversation> {
  const data = await request<{ conversation: SmartChatConversation }>(
    `conversations/${encodeURIComponent(uuid)}`,
    { method: 'PATCH', body: payload },
  );
  return data.conversation;
}

export async function enableSmartChatShare(uuid: string): Promise<NonNullable<SmartChatConversation['share']>> {
  const data = await request<{ share: NonNullable<SmartChatConversation['share']> }>(
    `conversations/${encodeURIComponent(uuid)}/share`,
    { method: 'POST' },
  );
  return data.share;
}

export async function disableSmartChatShare(uuid: string): Promise<void> {
  await request(`conversations/${encodeURIComponent(uuid)}/share`, { method: 'DELETE' });
}

export async function fetchSmartChatFolders(): Promise<SmartChatFolder[]> {
  const data = await request<{ folders: SmartChatFolder[] }>('folders');
  return data.folders ?? [];
}

export async function createSmartChatFolder(name: string): Promise<SmartChatFolder> {
  const data = await request<{ folder: SmartChatFolder }>('folders', {
    method: 'POST',
    body: { name },
  });
  return data.folder;
}

export async function deleteSmartChatFolder(uuid: string): Promise<void> {
  await request(`folders/${encodeURIComponent(uuid)}`, { method: 'DELETE' });
}

export async function fetchSmartChatMemories(): Promise<SmartChatMemory[]> {
  const data = await request<{ memories: SmartChatMemory[] }>('memories');
  return data.memories ?? [];
}

export async function createSmartChatMemory(
  content: string,
  conversationUuid?: string | null,
  /** true 면 서버가 핵심 팩트만 LLM 요약 후 저장 ("기억하기" 버튼용) */
  summarize = false,
): Promise<SmartChatMemory> {
  const data = await request<{ memory: SmartChatMemory }>('memories', {
    method: 'POST',
    body: {
      content,
      ...(conversationUuid ? { conversation_uuid: conversationUuid } : {}),
      ...(summarize ? { summarize: true } : {}),
    },
  });
  return data.memory;
}

export async function deleteSmartChatMemory(uuid: string): Promise<void> {
  await request(`memories/${encodeURIComponent(uuid)}`, { method: 'DELETE' });
}

export async function deleteSmartChatConversation(uuid: string): Promise<void> {
  await request(`conversations/${encodeURIComponent(uuid)}`, { method: 'DELETE' });
}

export async function fetchSmartChatMessages(uuid: string, limit = 100): Promise<{
  conversation: SmartChatConversation;
  messages: SmartChatMessage[];
}> {
  return request(`conversations/${encodeURIComponent(uuid)}/messages?limit=${limit}`);
}

export interface StreamSmartChatHandlers {
  onMeta?: (meta: Record<string, unknown>) => void;
  onDelta?: (text: string, accumulated: string) => void;
  /** 백엔드 function calling 진행 상태 — AI가 플랫폼 데이터를 조회 중일 때 */
  onTool?: (name: string, status: 'running' | 'done') => void;
  onDone?: (payload: {
    assistant_message: SmartChatMessage;
    conversation: SmartChatConversation;
    finish_reason?: string;
    /** 이번 턴에서 AI가 실제 사용한 도구명 목록 */
    tools?: string[];
    sources?: Array<{ title: string; url: string }>;
    usage?: { prompt_tokens?: number | null; completion_tokens?: number | null };
    credit?: { settled?: boolean; error?: string | null };
  }) => void;
  onError?: (message: string, code?: string) => void;
}

export async function streamSmartChatMessage(
  conversationUuid: string,
  content: string,
  modelId: string | undefined,
  handlers: StreamSmartChatHandlers,
  signal?: AbortSignal,
  options?: StreamSmartChatOptions,
): Promise<void> {
  const token = assertShellAccessToken();
  const response = await fetch(
    `/api/modules/moabom-smart-chat/conversations/${encodeURIComponent(conversationUuid)}/messages:stream`,
    {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        content,
        ...(modelId ? { model_id: modelId } : {}),
        ...(options?.attachmentUuids?.length ? { attachment_uuids: options.attachmentUuids } : {}),
        ...(options?.parentId != null ? { parent_id: options.parentId } : {}),
        ...(options?.generatedAppId != null ? { generated_app_id: options.generatedAppId } : {}),
        ...(options?.tools !== undefined ? { tools: options.tools } : {}),
        ...(options?.webSearch ? { web_search: true } : {}),
      }),
      signal,
    },
  );

  if (!response.ok || !response.body) {
    let message = 'AI 응답에 실패했습니다.';
    try {
      const json = (await response.json()) as { message?: string };
      if (json.message) message = json.message;
    } catch {
      // ignore
    }
    if (response.status === 401) {
      throw new MoabomShellAuthRequiredError();
    }
    handlers.onError?.(message);
    throw new MoabomShellModuleApiError(response.status, message, { success: false, message });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let eventName = 'message';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const sep = buffer.indexOf('\n\n');
      if (sep < 0) break;
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      let dataLine = '';
      for (const line of rawEvent.split('\n')) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLine += line.slice(5).trim();
        }
      }
      if (!dataLine) continue;

      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(dataLine) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (eventName === 'meta') {
        handlers.onMeta?.(payload);
      } else if (eventName === 'tool') {
        const status = payload.status === 'done' ? 'done' : 'running';
        handlers.onTool?.(String(payload.name ?? ''), status);
      } else if (eventName === 'delta') {
        const text = String(payload.text ?? '');
        if (text) {
          accumulated += text;
          handlers.onDelta?.(text, accumulated);
        }
      } else if (eventName === 'done') {
        handlers.onDone?.(payload as {
          assistant_message: SmartChatMessage;
          conversation: SmartChatConversation;
          finish_reason?: string;
          tools?: string[];
          sources?: Array<{ title: string; url: string }>;
          usage?: { prompt_tokens?: number | null; completion_tokens?: number | null };
          credit?: { settled?: boolean; error?: string | null };
        });
      } else if (eventName === 'error') {
        handlers.onError?.(String(payload.message ?? 'error'), String(payload.code ?? ''));
      }
      eventName = 'message';
    }
  }
}
