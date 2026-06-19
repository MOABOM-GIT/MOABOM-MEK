# Moabom Theme Sync Library

모아봄 껍데기(moabom_cafe24)와 iframe 앱 간의 테마 동기화를 담당하는 라이브러리입니다.

## 주요 기능

- ✅ PostMessage를 통한 실시간 테마 동기화
- ✅ URL 파라미터를 통한 초기 테마 로드
- ✅ CSS 변수 자동 적용
- ✅ TypeScript 타입 안전성
- ✅ React Hook 제공
- ✅ 4가지 테마 지원 (light, dark, performance, perf-dark)
- ✅ 포인트 컬러 커스터마이징

## 설치 및 사용법

### 1. 기본 사용 (React Hook)

```typescript
import { useMoabomTheme } from '@/lib/use-moabom-theme';

function MyApp() {
  const { theme, primaryColor, isDark } = useMoabomTheme({ 
    debug: true // 개발 중에는 true로 설정
  });

  return (
    <div className="bg-moa-bg text-moa-text">
      <h1>Current Theme: {theme}</h1>
      <p>Primary Color: {primaryColor}</p>
      <p>Is Dark Mode: {isDark ? 'Yes' : 'No'}</p>
    </div>
  );
}
```

### 2. 고급 사용 (Class 직접 사용)

```typescript
import { MoabomThemeSync } from '@/lib/moabom-theme-sync';

// 초기화
const themeSync = new MoabomThemeSync({
  onThemeChange: (theme) => {
    console.log('Theme changed:', theme);
  },
  onColorChange: (color) => {
    console.log('Color changed:', color);
  },
  parentOrigin: 'https://moabom.com', // 보안을 위해 정확한 origin 지정
  debug: true
});

// 현재 테마 정보 가져오기
const currentTheme = themeSync.getCurrentTheme();
console.log(currentTheme);

// 수동으로 테마 변경 (테스트용)
themeSync.setTheme('dark');
themeSync.setColor('#FF5733');

// 정리 (컴포넌트 언마운트 시)
themeSync.destroy();
```

### 3. Tailwind CSS 클래스 사용

라이브러리가 자동으로 CSS 변수를 설정하므로, Tailwind 클래스를 바로 사용할 수 있습니다:

```tsx
<div className="bg-moa-bg text-moa-text">
  <h1 className="text-moa-main">제목</h1>
  <p className="text-moa-text-secondary">부제목</p>
  <button className="bg-moa-main hover:opacity-90">버튼</button>
</div>
```

## 지원하는 테마

### 1. Light (라이트 모드)
- 밝은 배경, 어두운 텍스트
- 기본 포인트 컬러: `#00d2ff` (시안)

### 2. Dark (다크 모드)
- 어두운 배경, 밝은 텍스트
- 기본 포인트 컬러: `#8B5CF6` (보라)

### 3. Performance (성능 모드 - 라이트)
- 애니메이션 최소화
- 블러 효과 제거
- 기본 포인트 컬러: `#03a94d` (녹색)

### 4. Perf-Dark (성능 모드 - 다크)
- 애니메이션 최소화
- 블러 효과 제거
- 기본 포인트 컬러: `#5865F2` (블러플)

## CSS 변수 목록

라이브러리가 자동으로 설정하는 CSS 변수들:

```css
/* 텍스트 컬러 */
--text-lv1: 주요 텍스트
--text-lv2: 보조 텍스트
--text-lv3: 비활성 텍스트

/* 배경 컬러 */
--layout-max-lv1: 주요 배경
--layout-max-lv2: 보조 배경
--layout-max-lv3: 비활성 배경

/* 포인트 컬러 */
--color-main-lv1: 주요 포인트 컬러
--color-main-lv2: 포인트 컬러 (30% 투명도)
--color-main-lv3: 포인트 컬러 배경

/* 기타 */
--panel-radius: 패널 모서리 반경
--layout-shadow: 그림자 효과
--layout-blur: 블러 효과
--bg-gradient: 배경 그라데이션
```

## 통신 프로토콜

### 모아봄 → 앱 (THEME_UPDATE)

```typescript
{
  type: 'THEME_UPDATE',
  theme: 'dark',
  primaryColor: '#FF5733'
}
```

### 앱 → 모아봄 (REQUEST_THEME)

```typescript
{
  type: 'REQUEST_THEME'
}
```

## 동작 원리

1. **초기 로드**
   - URL 파라미터에서 테마 정보 추출 (`?theme=dark&primary=FF5733`)
   - 부모 창(모아봄)에 현재 테마 요청 (`REQUEST_THEME`)
   - 받은 테마 정보를 CSS 변수로 적용

2. **실시간 동기화**
   - 모아봄에서 테마 변경 시 모든 iframe에 `THEME_UPDATE` 메시지 브로드캐스트
   - 각 앱이 메시지를 받아 CSS 변수 업데이트
   - React 상태 업데이트로 UI 리렌더링

3. **보안**
   - PostMessage origin 검증
   - iframe sandbox 속성 활용
   - HTTPS 통신 권장

## 트러블슈팅

### 테마가 적용되지 않을 때

1. **브라우저 콘솔 확인**
   ```typescript
   // debug 모드 활성화
   const { theme } = useMoabomTheme({ debug: true });
   ```

2. **CSS 변수 확인**
   ```javascript
   // 개발자 도구 콘솔에서
   getComputedStyle(document.documentElement).getPropertyValue('--color-main-lv1')
   ```

3. **PostMessage 확인**
   ```javascript
   // 모아봄 껍데기 콘솔에서
   window.MoaConfig.get('theme')
   window.MoaConfig.get('pointColor')
   ```

### iframe이 메시지를 받지 못할 때

- iframe의 `sandbox` 속성 확인
- `allow-same-origin allow-scripts` 권한 필요
- origin 검증 설정 확인

## 예제 프로젝트

### cpap-mask 앱

`apps/app/cpap-mask/page.tsx` 파일을 참고하세요:

```typescript
import { useMoabomTheme } from '@/lib/use-moabom-theme';

export default function Home() {
  const { theme, primaryColor, isDark } = useMoabomTheme({ debug: true });

  return (
    <div className="bg-moa-bg text-moa-text">
      {/* 앱 내용 */}
    </div>
  );
}
```

## 새로운 앱에 적용하기

1. **라이브러리 import**
   ```typescript
   import { useMoabomTheme } from '@/lib/use-moabom-theme';
   ```

2. **Hook 사용**
   ```typescript
   const { theme, primaryColor, isDark } = useMoabomTheme();
   ```

3. **Tailwind 클래스 사용**
   ```tsx
   <div className="bg-moa-bg text-moa-text">
     <button className="bg-moa-main">버튼</button>
   </div>
   ```

4. **끝!** 🎉

## 라이센스

MIT License

## 문의

문제가 발생하거나 개선 사항이 있으면 이슈를 등록해주세요.
