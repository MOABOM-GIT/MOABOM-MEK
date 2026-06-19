'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useMoabomTheme } from '@/shared/lib/use-moabom-theme';
import { getMoabomUser, setupLoginSync } from '@/shared/lib/moabom-auth';
import { BACKEND_CONFIG, AI_MODELS, type AIModelId } from '@/shared/lib/ai-config';

const APP_TYPES = [
  { id: 'general', name: 'General App', icon: 'ri-window-line' },
  { id: '3d', name: '3D Scene', icon: 'ri-box-3-line' },
  { id: 'game', name: 'Game', icon: 'ri-gamepad-line' },
  { id: 'dataviz', name: 'Data Visualization', icon: 'ri-bar-chart-line' },
];

// 안전 CSS 주입 함수: 무한 증식 방지
function injectSafetyCSS(html: string): string {
  const safetyCSS = `
    <style id="kiro-safety-css">
      /* 무한 증식 방지 */
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        max-height: 100vh;
        overflow: auto;
      }
      
      /* 모든 컨테이너 최대 높이 제한 */
      * {
        max-height: 100vh;
      }
      
      /* 캔버스/차트 컨테이너 강제 제한 */
      canvas {
        max-width: 100% !important;
        max-height: 80vh !important;
      }
      
      /* 차트 컨테이너 */
      [id*="chart"], [class*="chart"], .chart-container {
        max-height: 500px !important;
        height: 500px !important;
        position: relative !important;
      }
    </style>
    <script id="kiro-safety-script">
      // Chart.js 중복 생성 방지
      (function() {
        const originalChart = window.Chart;
        if (!originalChart) return;
        
        const chartInstances = new Map();
        
        window.Chart = function(ctx, config) {
          const canvasId = ctx.id || ctx.canvas?.id;
          
          // 기존 차트 인스턴스 제거
          if (canvasId && chartInstances.has(canvasId)) {
            try {
              chartInstances.get(canvasId).destroy();
            } catch (e) {
              console.warn('Chart destroy failed:', e);
            }
          }
          
          // 새 차트 생성
          const chart = new originalChart(ctx, config);
          if (canvasId) {
            chartInstances.set(canvasId, chart);
          }
          
          return chart;
        };
        
        // Chart 프로토타입 복사
        Object.setPrototypeOf(window.Chart, originalChart);
        window.Chart.prototype = originalChart.prototype;
      })();
    </script>
  `;
  
  // </head> 태그 직전에 안전 CSS 삽입
  if (html.includes('</head>')) {
    return html.replace('</head>', `${safetyCSS}</head>`);
  } else if (html.includes('<body>')) {
    return html.replace('<body>', `<head>${safetyCSS}</head><body>`);
  } else {
    return html;
  }
}

// HTML 추출 함수
function extractHTML(text: string): string {
  if (!text) return '';
  
  let extracted = text.trim();
  
  // 마크다운 코드 블록 제거
  const codeBlockMatch = text.match(/```html\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    extracted = codeBlockMatch[1].trim();
  }
  
  // HTML 유효성 검사 - 더 엄격하게
  const hasDoctype = extracted.includes('<!DOCTYPE html>');
  const hasHtmlTag = extracted.includes('<html');
  const hasClosingHtml = extracted.includes('</html>');
  const hasHead = extracted.includes('<head');
  const hasClosingHead = extracted.includes('</head>');
  const hasBody = extracted.includes('<body');
  const hasClosingBody = extracted.includes('</body>');
  
  // style 태그 검증 - 열린 style 태그가 있으면 닫힌 것도 있어야 함
  const openStyleTags = (extracted.match(/<style/g) || []).length;
  const closeStyleTags = (extracted.match(/<\/style>/g) || []).length;
  const styleTagsComplete = openStyleTags === closeStyleTags;
  
  // script 태그 검증 - 열린 script 태그가 있으면 닫힌 것도 있어야 함
  const openScriptTags = (extracted.match(/<script/g) || []).length;
  const closeScriptTags = (extracted.match(/<\/script>/g) || []).length;
  const scriptTagsComplete = openScriptTags === closeScriptTags;
  
  // 최소 조건: head와 body가 완전히 닫혀있고, style/script 태그도 완전해야 렌더링
  if ((hasDoctype || hasHtmlTag) && 
      hasHead && hasClosingHead && 
      hasBody && hasClosingBody && 
      hasClosingHtml &&
      styleTagsComplete &&
      scriptTagsComplete) {
    return injectSafetyCSS(extracted);
  }
  
  return '';
}

export default function AIGeneratorPage() {
  // 모아봄 테마 동기화
  useMoabomTheme({ debug: true });

  const [appType, setAppType] = useState('general');
  const [appTitle, setAppTitle] = useState('');
  const [user, setUser] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState<AIModelId>('claude-sonnet'); // 기본값: Claude
  
  // 자동 스크롤을 위한 ref
  const aiResponseRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Vercel AI SDK 6 - 에이전트 기반 아키텍처
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/generate',
      body: { 
        type: appType,
        modelId: selectedModel // 선택된 모델 전달
      },
    }),
    onFinish: (options: any) => {
      console.log('✅ 생성 완료:', options.messages[options.messages.length - 1]?.content?.substring(0, 100));
      
      // 토큰 제한 감지 (불완전한 HTML)
      const lastMessage = options.messages[options.messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        const textParts = lastMessage.parts
          ?.filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join('') || '';
        
        // HTML이 있지만 </html>로 끝나지 않으면 불완전
        const hasHTML = textParts.includes('<!DOCTYPE html>') || textParts.includes('<html');
        const isComplete = textParts.includes('</html>');
        
        if (hasHTML && !isComplete) {
          console.warn('⚠️ 불완전한 HTML 감지 - 토큰 제한 가능성');
          
          // 사용자에게 확인 요청
          const shouldContinue = window.confirm(
            '토큰 제한으로 코딩이 중단되었습니다.\n\n계속 진행할까요?'
          );
          
          if (shouldContinue) {
            // 자동으로 "이어서 작성해줘" 메시지 전송
            setTimeout(() => {
              sendMessage({
                text: '중단된 부분부터 이어서 나머지 코드를 완성해줘. 이미 작성된 부분은 제외하고 나머지만 작성해줘.',
              });
            }, 500);
          }
        }
      }
    },
    onError: (error: Error) => {
      console.error('❌ Chat error:', error);
      
      // 네트워크 오류 감지
      const isNetworkError = error.message.includes('network') || 
                            error.message.includes('fetch') ||
                            error.message.includes('Failed to fetch') ||
                            error.message.includes('NetworkError');
      
      if (isNetworkError) {
        // 네트워크 오류 시 재시도 옵션 제공
        const shouldRetry = window.confirm(
          '네트워크 오류로 코딩이 중단되었습니다.\n\n이어서 진행할까요?'
        );
        
        if (shouldRetry) {
          // 마지막 사용자 메시지 다시 전송 (이어서 작성)
          const lastUserMessage = messages.filter(m => m.role === 'user').pop();
          if (lastUserMessage) {
            setTimeout(() => {
              const lastUserText = lastUserMessage.parts
                ?.filter((part: any) => part.type === 'text')
                .map((part: any) => part.text)
                .join('') || '';
              
              // 이미 진행 중이었다면 이어서, 처음이었다면 다시 시작
              if (messages.length > 1) {
                sendMessage({
                  text: '중단된 부분부터 이어서 나머지 코드를 완성해줘. 이미 작성된 부분은 제외하고 나머지만 작성해줘.',
                });
              } else {
                sendMessage({
                  text: lastUserText,
                });
              }
            }, 1000);
          }
        }
      } else {
        // 일반 오류
        alert('앱 생성 중 오류가 발생했습니다: ' + error.message);
      }
    },
  });

  // 입력 상태는 직접 관리 (v6 방식)
  const [input, setInput] = useState('');
  
  // 로딩 상태 계산
  const isLoading = status === 'submitted' || status === 'streaming';

  // 사용자 정보 가져오기
  useEffect(() => {
    const moabomUser = getMoabomUser();
    if (moabomUser) {
      setUser(moabomUser);
    }
    
    const cleanup = setupLoginSync((updatedUser) => {
      setUser(updatedUser);
      if (updatedUser) {
        console.log('[AI Generator] User logged in:', updatedUser.mb_nick);
      } else {
        console.log('[AI Generator] User logged out');
      }
    });
    
    return cleanup;
  }, []);

  // 실시간 HTML 추출 (Websim처럼 스트리밍 중에도 업데이트)
  const generatedHTML = useMemo(() => {
    const lastMessage: any = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      // v6: parts 배열에서 text 추출
      const textParts = lastMessage.parts
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('');
      return extractHTML(textParts);
    }
    return '';
  }, [messages]);

  // AI 응답 텍스트 (디버깅용)
  const streamedResponse = useMemo(() => {
    const lastMessage: any = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      // v6: parts 배열에서 text 추출
      const textParts = lastMessage.parts
        .filter((part: any) => part.type === 'text')
        .map((part: any) => part.text)
        .join('');
      return textParts;
    }
    return '';
  }, [messages]);

  // 자동 스크롤: AI 응답이 업데이트될 때마다 스크롤
  useEffect(() => {
    if (isLoading && streamedResponse && aiResponseRef.current) {
      // AI 응답 컨테이너 내부의 스크롤 가능한 div 찾기
      const scrollContainer = aiResponseRef.current.querySelector('.overflow-y-auto');
      if (scrollContainer) {
        // 내부 스크롤을 맨 아래로 이동 (코딩되는 내용 따라가기)
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [streamedResponse, isLoading]);

  // 생성 완료 시 미리보기로 스크롤
  useEffect(() => {
    if (!isLoading && generatedHTML && previewRef.current) {
      // 약간의 딜레이 후 미리보기로 스크롤
      setTimeout(() => {
        previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
    }
  }, [isLoading, generatedHTML]);

  const handleSaveToMOABOM = async () => {
    if (!generatedHTML || !appTitle) {
      alert('앱을 생성하고 제목을 입력해주세요');
      return;
    }

    if (!user || !user.mb_id) {
      alert('로그인이 필요합니다');
      return;
    }

    try {
      const saveUrl: string = BACKEND_CONFIG.getUrl('saveApp');
      
      const response = await fetch(saveUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          html: generatedHTML,
          title: appTitle,
          type: appType,
          user_id: user.mb_id
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      if (result.success) {
        window.parent.postMessage(
          {
            type: 'CREATE_APP_ICON',
            payload: {
              id: result.app_id,
              name: result.title,
              type: 'user-app',
              url: result.url,
              iconClass: getIconByType(appType),
              color: getColorByType(appType),
              appType: appType
            },
          },
          '*'
        );

        window.parent.postMessage(
          {
            type: 'SHOW_TOAST',
            message: `${result.title} 앱이 바탕화면에 추가되었습니다!`,
            variant: 'save'
          },
          '*'
        );
        
        setAppTitle('');
      } else {
        window.parent.postMessage(
          {
            type: 'SHOW_TOAST',
            message: `저장 실패: ${result.message}`,
            variant: 'error'
          },
          '*'
        );
      }
    } catch (error: any) {
      window.parent.postMessage(
        {
          type: 'SHOW_TOAST',
          message: `저장 중 오류가 발생했습니다: ${error.message}`,
          variant: 'error'
        },
        '*'
      );
    }
  };

  const getIconByType = (type: string) => {
    const icons: Record<string, string> = {
      'general': 'ri-window-line',
      '3d': 'ri-box-3-line',
      'game': 'ri-gamepad-line',
      'dataviz': 'ri-bar-chart-line'
    };
    return icons[type] || 'ri-window-line';
  };

  const getColorByType = (type: string) => {
    const colors: Record<string, string> = {
      'general': 'linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%)',
      '3d': 'linear-gradient(135deg, rgb(139, 92, 246) 0%, rgb(219, 39, 119) 100%)',
      'game': 'linear-gradient(135deg, rgb(236, 72, 153) 0%, rgb(239, 68, 68) 100%)',
      'dataviz': 'linear-gradient(135deg, rgb(34, 197, 94) 0%, rgb(59, 130, 246) 100%)'
    };
    return colors[type] || 'linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%)';
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center font-sans text-moa-text">
      <div className="relative w-full h-screen md:h-auto md:max-h-screen flex flex-col overflow-hidden">
        
        <div className="flex-1 overflow-y-auto pt-8 pb-6 px-6">
          <div className="max-w-4xl mx-auto">

            {/* App Type Selector */}
            <div className="glass-panel p-6 mb-6">
              <label className="block text-moa-text-secondary text-sm font-semibold mb-3">
                {user?.mb_nick ? `${user.mb_nick}님, ` : ''}앱 타입을 선택하고 원하는 앱을 만들어보세요.
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {APP_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setAppType(type.id)}
                    className={`p-4 rounded-xl transition-all ${
                      appType === type.id
                        ? 'bg-moa-main text-white'
                        : 'bg-moa-bg-secondary text-moa-text-secondary hover:bg-moa-bg-tertiary'
                    }`}
                  >
                    <i className={`${type.icon} text-3xl mb-2 block`}></i>
                    <div className="text-sm font-medium">{type.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* AI Model Selector */}
            <div className="glass-panel p-6 mb-6">
              <label className="block text-moa-text-secondary text-sm font-semibold mb-3">
                <i className="ri-robot-line"></i> AI 모델 선택
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.values(AI_MODELS).map((model) => (
                  <button
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={`p-4 rounded-xl transition-all text-left ${
                      selectedModel === model.id
                        ? 'bg-moa-main text-white'
                        : 'bg-moa-bg-secondary text-moa-text-secondary hover:bg-moa-bg-tertiary'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <i className={`${model.icon} text-2xl`} style={{ color: selectedModel === model.id ? 'white' : model.color }}></i>
                      <div className="text-sm font-bold">{model.name}</div>
                    </div>
                    <div className="text-xs opacity-80">{model.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Input */}
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                
                // 로그인 체크
                if (!user || !user.mb_id) {
                  alert('로그인 후 이용해주세요');
                  return;
                }
                
                if (!input.trim() || isLoading) return;
                
                // v6 방식: sendMessage로 메시지 전송
                await sendMessage({
                  text: input,
                });
                
                // 입력 초기화
                setInput('');
              }} 
              className="glass-panel p-6 mb-6"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={user && user.mb_id ? "예: 회전하는 3D 큐브를 만들어줘..." : "로그인 후 이용해주세요"}
                className="w-full h-32 bg-moa-bg-secondary text-moa-text rounded-xl p-4 border-0 focus:outline-none resize-none"
                disabled={isLoading || !user || !user.mb_id}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || !user || !user.mb_id}
                className="btn btn-lg is-lv1 w-full mt-4 text-white font-bold"
              >
                {!user || !user.mb_id ? (
                  <>
                    <i className="ri-lock-line"></i>
                    로그인 후 이용해주세요
                  </>
                ) : isLoading ? (
                  <>
                    <i className="ri-loader-4-line animate-spin"></i>
                    생성 중...
                  </>
                ) : (
                  <>
                    <i className="ri-sparkling-line"></i>
                    앱 생성하기
                  </>
                )}
              </button>
            </form>

            {/* AI Response Stream */}
            {(isLoading || streamedResponse) && (
              <div className="glass-panel p-6 mb-6" ref={aiResponseRef}>
                <h2 className="text-moa-text-secondary text-base font-semibold mb-4 flex items-center gap-2">
                  <i className={`${isLoading ? 'ri-loader-4-line animate-spin' : 'ri-code-s-slash-line'}`}></i>
                  {isLoading ? 'AI가 열심히 앱 제작중...' : 'AI 응답'}
                </h2>
                <div className="bg-moa-bg-secondary rounded-xl p-4 max-h-96 overflow-y-auto overflow-x-hidden">
                  <pre className="whitespace-pre-wrap break-words text-sm text-moa-text-tertiary font-mono overflow-x-auto">{streamedResponse}</pre>
                </div>
              </div>
            )}

            {/* Preview & Save - 실시간 렌더링 */}
            {generatedHTML && (
              <div className="glass-panel p-6" ref={previewRef}>
                <div className="flex flex-col gap-4 mb-4">
                  <h2 className="text-moa-text-secondary text-base font-semibold flex items-center gap-2">
                    <i className="ri-eye-line"></i>
                    미리보기 (실시간)
                  </h2>
                  <div className="flex flex-col sm:flex-row gap-2 w-full">
                    <input
                      type="text"
                      value={appTitle}
                      onChange={(e) => setAppTitle(e.target.value)}
                      placeholder="앱 제목..."
                      className="flex-1 bg-moa-bg-secondary text-moa-text rounded-lg px-4 py-2 border-0 focus:outline-none min-w-0"
                    />
                    <button
                      onClick={handleSaveToMOABOM}
                      className="btn is-lv1 text-white font-bold px-6 rounded-lg whitespace-nowrap"
                    >
                      <i className="ri-save-line"></i>
                      저장
                    </button>
                  </div>
                </div>
                <iframe
                  srcDoc={generatedHTML}
                  className="w-full h-[600px] bg-white rounded-xl overflow-hidden"
                  sandbox="allow-scripts allow-same-origin"
                  style={{ maxHeight: '600px', minHeight: '600px' }}
                />
                
                {/* 수정 요청 입력창 */}
                <div className="mt-4 p-4 bg-moa-bg-secondary rounded-xl">
                  <label className="block text-moa-text-secondary text-sm font-semibold mb-2">
                    <i className="ri-edit-line"></i> 수정 요청
                  </label>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      
                      // 로그인 체크
                      if (!user || !user.mb_id) {
                        alert('로그인 후 이용해주세요');
                        return;
                      }
                      
                      if (!input.trim() || isLoading) return;
                      
                      await sendMessage({
                        text: input,
                      });
                      
                      setInput('');
                      
                      // 수정 요청 후 AI 응답 영역으로 스크롤
                      setTimeout(() => {
                        aiResponseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 100);
                    }}
                    className="flex flex-col sm:flex-row gap-2"
                  >
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={user && user.mb_id ? "예: 숫자 순서를 바로잡아줘, 색상을 파란색으로 바꿔줘..." : "로그인 후 이용해주세요"}
                      className="flex-1 bg-moa-bg-tertiary text-moa-text rounded-lg px-4 py-2 border-0 focus:outline-none text-sm min-w-0"
                      disabled={isLoading || !user || !user.mb_id}
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !input.trim() || !user || !user.mb_id}
                      className="btn is-lv2 text-white font-bold px-6 rounded-lg whitespace-nowrap min-w-[60px]"
                    >
                      {isLoading ? (
                        <i className="ri-loader-4-line animate-spin"></i>
                      ) : (
                        <i className="ri-send-plane-fill"></i>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
