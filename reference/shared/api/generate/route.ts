import { streamText, convertToModelMessages, UIMessage } from 'ai';
import { AI_CONFIG, type AIModelId } from '@/shared/lib/ai-config';
import { 
  GENERAL_APP_PROMPT, 
  THREE_D_PROMPT, 
  GAME_PROMPT, 
  DATAVIZ_PROMPT 
} from './prompts';

/**
 * HTML 추출 함수 (서버용)
 */
function extractHTMLFromMessage(content: string): string {
  if (!content) return '';
  
  // 마크다운 코드 블록 제거
  const codeBlockMatch = content.match(/```html\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  
  // HTML 태그가 있으면 그대로 반환
  if (content.includes('<!DOCTYPE html>') || content.includes('<html')) {
    return content.trim();
  }
  
  return '';
}

/**
 * 통합 AI 생성 라우터
 * 
 * 토큰 최적화 전략:
 * - 첫 요청: 전체 프롬프트 전송
 * - 수정 요청: "기존 HTML + 수정 지시" 형태로 압축
 */
export async function POST(req: Request) {
  const { 
    messages, 
    type = 'general',
    modelId = 'claude-sonnet' 
  }: { 
    messages: UIMessage[]; 
    type?: string;
    modelId?: AIModelId;
  } = await req.json();

  const systemPrompts: Record<string, string> = {
    'general': GENERAL_APP_PROMPT,
    '3d': THREE_D_PROMPT,
    'game': GAME_PROMPT,
    'dataviz': DATAVIZ_PROMPT,
  };

  const selectedSystemPrompt = systemPrompts[type] || systemPrompts.general;
  const selectedModel = AI_CONFIG.getModel(modelId);

  // 토큰 최적화: 수정 요청 감지 및 메시지 압축
  let optimizedMessages = messages;
  let isModificationRequest = false;
  
  if (messages.length >= 3) {
    // 수정 요청인 경우
    const lastUserMessage = messages[messages.length - 1];
    const lastAssistantMessage = messages[messages.length - 2];
    
    // AI 응답에서 HTML 추출
    let htmlContent = '';
    if (lastAssistantMessage && lastAssistantMessage.role === 'assistant') {
      const textParts = lastAssistantMessage.parts
        ?.filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('') || '';
      htmlContent = extractHTMLFromMessage(textParts);
    }
    
    if (htmlContent && lastUserMessage.role === 'user') {
      isModificationRequest = true;
      
      // 수정 요청용 압축 메시지
      const modificationPrompt = lastUserMessage.parts
        ?.filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('') || '';
      
      optimizedMessages = [
        {
          id: 'modification-request',
          role: 'user',
          parts: [
            {
              type: 'text',
              text: `다음 HTML 코드를 수정해주세요.

수정 요청: ${modificationPrompt}

기존 HTML 코드:
\`\`\`html
${htmlContent}
\`\`\`

위 HTML 코드를 수정 요청에 맞게 수정하고, 전체 HTML 코드를 다시 출력해주세요.`
            }
          ]
        } as UIMessage
      ];
      
      console.log('✅ 토큰 최적화 (수정 요청)', {
        originalMessages: messages.length,
        optimizedMessages: optimizedMessages.length,
        htmlLength: htmlContent.length,
        modificationPrompt
      });
    }
  }

  const result = streamText({
    model: selectedModel,
    system: selectedSystemPrompt,
    messages: await convertToModelMessages(optimizedMessages),
    temperature: AI_CONFIG.temperature,
    maxOutputTokens: AI_CONFIG.maxOutputTokens,
    onFinish: async ({ text, finishReason }) => {
      // 토큰 제한으로 중단된 경우 로그
      if (finishReason === 'length') {
        console.warn('⚠️ 토큰 제한 도달: 응답이 잘렸을 수 있습니다', {
          textLength: text.length,
          finishReason
        });
      }
    }
  });

  return result.toUIMessageStreamResponse();
}
