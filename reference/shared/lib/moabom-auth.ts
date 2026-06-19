/**
 * 모아봄 JWT 인증 유틸리티
 */

// 전역 상태 저장
let cachedUser: MoabomUser | null = null;
let cachedToken: string | null = null;

export interface MoabomUser {
  mb_id: string;
  mb_name: string;
  mb_nick: string;
  mb_email: string;
  mb_level: number;
  iat: number;
  exp: number;
}

/**
 * URL에서 JWT 토큰 추출
 */
export function getTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  
  const params = new URLSearchParams(window.location.search);
  return params.get('token');
}

/**
 * JWT 토큰 디코딩 (검증 없이 payload만 추출)
 * 주의: 서버에서 검증 필요!
 */
export function decodeJWT(token: string): MoabomUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    
    // 만료 시간 확인
    if (payload.exp && payload.exp < Date.now() / 1000) {
      console.warn('[MoabomAuth] Token expired');
      return null;
    }
    
    return payload as MoabomUser;
  } catch (error) {
    console.error('[MoabomAuth] Failed to decode token:', error);
    return null;
  }
}

/**
 * 모아봄 사용자 정보 가져오기
 */
export function getMoabomUser(): MoabomUser | null {
  // 1. 캐시된 사용자 정보가 있으면 반환
  if (cachedUser && cachedToken) {
    return cachedUser;
  }
  
  // 2. URL에서 토큰 추출
  const token = getTokenFromUrl();
  if (!token) {
    console.warn('[MoabomAuth] No token found in URL');
    
    // 3. 부모 창에 로그인 상태 요청 (Pull 방식)
    if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage({ type: 'REQUEST_LOGIN_STATE' }, '*');
    }
    
    return null;
  }
  
  // 4. 토큰 디코딩 및 캐시
  const user = decodeJWT(token);
  if (user) {
    cachedUser = user;
    cachedToken = token;
  }
  
  return user;
}

/**
 * [NEW] 부모 창에서 로그인 상태 업데이트 받기 (Pull 방식)
 * React 컴포넌트에서 useEffect로 호출
 */
export function setupLoginSync(onLoginChange: (user: MoabomUser | null) => void) {
  if (typeof window === 'undefined') return;
  
  const handleMessage = (event: MessageEvent) => {
    if (event.data.type === 'LOGIN_STATE_UPDATE') {
      const { token } = event.data;
      
      if (token) {
        const user = decodeJWT(token);
        if (user) {
          cachedUser = user;
          cachedToken = token;
          console.log('[MoabomAuth] Login state updated from parent:', user.mb_nick);
          onLoginChange(user);
        }
      } else {
        // 로그아웃
        cachedUser = null;
        cachedToken = null;
        console.log('[MoabomAuth] Logged out from parent');
        onLoginChange(null);
      }
    }
  };
  
  window.addEventListener('message', handleMessage);
  
  // 초기 로그인 상태 요청 (Pull 방식)
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'REQUEST_LOGIN_STATE' }, '*');
  }
  
  // Cleanup 함수 반환
  return () => {
    window.removeEventListener('message', handleMessage);
  };
}

/**
 * 로그인 여부 확인
 */
export function isAuthenticated(): boolean {
  return getMoabomUser() !== null;
}

/**
 * Supabase와 연동하기 위한 커스텀 토큰 생성
 * (Supabase Auth를 사용하는 경우)
 */
export async function createSupabaseSession(token: string) {
  // 이 부분은 Supabase 설정에 따라 구현
  // 옵션 1: Supabase Auth의 signInWithIdToken 사용
  // 옵션 2: 서버리스 함수로 검증 후 Supabase 세션 생성
  
  const user = decodeJWT(token);
  if (!user) {
    throw new Error('Invalid token');
  }
  
  return user;
}
