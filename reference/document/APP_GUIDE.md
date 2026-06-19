# MOABOM Apps 관리 가이드

## 프로젝트 구조

```
apps/
├── app/
│   ├── page.tsx                    # 메인 랜딩 페이지 (앱 목록)
│   ├── cpap-mask/
│   │   └── page.tsx                # 양압기 마스크 측정 앱
│   ├── layout.tsx                  # 공통 레이아웃
│   └── globals.css
├── lib/
│   ├── moabom-auth.ts              # 모아봄 인증 (JWT)
│   ├── supabase.ts                 # Supabase 클라이언트
│   └── face-measurement.ts         # 얼굴 측정 유틸리티
└── public/
```

## 새 앱 추가하기

### 1. 새 앱 폴더 생성

```bash
# apps/app/ 폴더에 새 앱 폴더 생성
mkdir apps/app/my-new-app
```

### 2. page.tsx 파일 생성

`apps/app/my-new-app/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { getMoabomUser, type MoabomUser } from "@/lib/moabom-auth";

export default function MyNewApp() {
  const [user, setUser] = useState<MoabomUser | null>(null);

  useEffect(() => {
    const moabomUser = getMoabomUser();
    if (moabomUser) {
      setUser(moabomUser);
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <h1>My New App</h1>
      {user && <p>환영합니다, {user.mb_nick}님!</p>}
    </div>
  );
}
```

### 3. 메인 페이지에 앱 등록

`apps/app/page.tsx`의 `apps` 배열에 추가:

```tsx
const apps = [
  {
    id: 'cpap-mask',
    name: 'CPAP 마스크 측정',
    description: '3D 안면 분석을 통한 양압기 마스크 사이즈 추천',
    icon: '🎭',
    path: '/cpap-mask',
    color: 'from-blue-600 to-indigo-600'
  },
  // 새 앱 추가
  {
    id: 'my-new-app',
    name: '내 새 앱',
    description: '앱 설명을 여기에 작성',
    icon: '🚀',
    path: '/my-new-app',
    color: 'from-green-600 to-emerald-600'
  },
];
```

### 4. 모아봄 플랫폼에 앱 등록

`moabom_cafe24/index.php`의 해당 모드 배열에 추가:

```php
'work' => [
    // 기존 앱들...
    [
        "id" => "my-new-app",
        "name" => "내 새 앱",
        "url" => "https://apps-zeta-black.vercel.app/my-new-app",
        "type" => "work",
        "iconClass" => "ri-rocket-fill",
        "color" => "linear-gradient(135deg,#10b981,#34d399)"
    ],
],
```

### 5. 배포

```bash
# Git push (Vercel 자동 배포)
git add .
git commit -m "Add new app: my-new-app"
git push

# 또는 push.bat 실행
push.bat
```

## 앱 간 공통 기능

### 사용자 인증

```tsx
import { getMoabomUser } from "@/lib/moabom-auth";

const user = getMoabomUser();
// user.mb_id, user.mb_nick, user.mb_email 사용 가능
```

### Supabase 데이터베이스

```tsx
import { supabase } from "@/lib/supabase";

// 데이터 조회
const { data, error } = await supabase
  .from('my_table')
  .select('*')
  .eq('user_id', user.mb_id);

// 데이터 삽입
const { data, error } = await supabase
  .from('my_table')
  .insert({ user_id: user.mb_id, data: 'value' });
```

### 모아봄으로 메시지 전송

```tsx
// 부모 창(모아봄)으로 메시지 전송
window.parent.postMessage({
  type: 'MY_EVENT',
  data: { /* 데이터 */ }
}, '*');
```

## 스타일링

- Tailwind CSS 사용
- 다크모드 지원: `dark:` prefix 사용
- 반응형: `md:`, `lg:` breakpoints 사용

## 환경 변수

`.env.local` 파일에 환경 변수 추가:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
NEXT_PUBLIC_MY_API_KEY=your_api_key
```

## 디버깅

- 개발 서버: `npm run dev` (http://localhost:3000)
- 프로덕션 빌드: `npm run build`
- 로그 확인: 브라우저 개발자 도구 콘솔

## 참고

- Next.js App Router: https://nextjs.org/docs/app
- Tailwind CSS: https://tailwindcss.com/docs
- Supabase: https://supabase.com/docs
