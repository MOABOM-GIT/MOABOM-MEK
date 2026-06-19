# 양압기 마스크 측정 앱 - 모아봄 통합 가이드

## 1. 모아봄 설정 완료 ✅

`index.php`의 work 모드에 앱이 추가되었습니다:

```php
["id"=>"cpap-mask","name"=>"양압기 마스크 측정","url"=>"https://your-vercel-app.vercel.app","type"=>"work","iconClass"=>"ri-scan-face-fill","color"=>"linear-gradient(135deg,#667eea,#764ba2)"]
```

### 설정 내용:
- **앱 ID**: `cpap-mask`
- **앱 이름**: 양압기 마스크 측정
- **아이콘**: `ri-scan-face-fill` (얼굴 스캔 아이콘)
- **색상**: 보라색 그라데이션
- **위치**: MOABOM WORK 모드

---

## 2. Vercel 배포 후 해야 할 일

### 2.1 URL 업데이트
Vercel에 배포 완료 후, `index.php` 파일에서 URL을 실제 배포 주소로 변경하세요:

```php
// 변경 전
"url"=>"https://your-vercel-app.vercel.app"

// 변경 후 (예시)
"url"=>"https://cpap-mask-measurement.vercel.app"
```

### 2.2 iframe 허용 설정 (중요!)
Vercel 앱에서 iframe 임베딩을 허용해야 합니다.

#### Next.js의 경우 (`next.config.js`):
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOW-FROM https://your-moabom-domain.com', // 모아봄 도메인
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://your-moabom-domain.com",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```

#### Vercel 설정 파일 (`vercel.json`):
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "SAMEORIGIN"
        },
        {
          "key": "Content-Security-Policy",
          "value": "frame-ancestors 'self' https://your-moabom-domain.com"
        }
      ]
    }
  ]
}
```

---

## 3. 웹캠 권한 설정 (중요!)

얼굴 스캔을 위해 웹캠 접근이 필요합니다. iframe 내에서 웹캠을 사용하려면:

### 3.1 모아봄 측 설정
`WindowManager.js`의 iframe 생성 부분에 권한 추가가 필요합니다.

현재 코드:
```javascript
<iframe src="" class="app-iframe" style="width:100%; height:100%; border:none;"></iframe>
```

수정 필요:
```javascript
<iframe 
  src="" 
  class="app-iframe" 
  allow="camera; microphone; fullscreen"
  style="width:100%; height:100%; border:none;">
</iframe>
```

### 3.2 HTTPS 필수
- 웹캠 접근은 HTTPS에서만 가능합니다
- 로컬 테스트: `localhost`는 예외적으로 HTTP 허용
- 배포 환경: 반드시 HTTPS 사용

---

## 4. 추천 기술 스택

### Frontend (Vercel)
```
- Next.js 14 (App Router)
- Three.js (3D 시각화)
- @mediapipe/face_mesh (얼굴 인식)
- TailwindCSS (스타일링)
```

### Backend API (선택사항)
```
- Python FastAPI (얼굴 측정 알고리즘)
- Railway/Render 배포
```

### Database
```
- Supabase (측정 데이터, 추천 이력)
```

---

## 5. 개발 체크리스트

### Phase 1: 기본 구조
- [ ] Next.js 프로젝트 생성
- [ ] Vercel 배포 설정
- [ ] iframe 허용 헤더 설정
- [ ] 모아봄에서 앱 로드 테스트

### Phase 2: 얼굴 스캔 기능
- [ ] MediaPipe Face Mesh 통합
- [ ] 웹캠 권한 요청 UI
- [ ] 얼굴 랜드마크 감지
- [ ] 3D 시각화 (Three.js)

### Phase 3: 측정 알고리즘
- [ ] 코 너비 측정
- [ ] 얼굴 길이 측정
- [ ] 턱 각도 측정
- [ ] 마스크 사이즈 추천 로직

### Phase 4: 데이터 저장
- [ ] Supabase 연동
- [ ] 측정 이력 저장
- [ ] 추천 결과 저장
- [ ] 사용자 관리

### Phase 5: UI/UX
- [ ] 측정 가이드 UI
- [ ] 결과 리포트 화면
- [ ] 마스크 제품 추천 화면
- [ ] 반응형 디자인

---

## 6. 모아봄 iframe 통신 (선택사항)

앱과 모아봄 플랫폼 간 통신이 필요한 경우:

### 앱에서 모아봄으로 메시지 전송:
```javascript
// 측정 완료 알림
window.parent.postMessage({
  type: 'MEASUREMENT_COMPLETE',
  data: { size: 'M', confidence: 0.95 }
}, 'https://your-moabom-domain.com');
```

### 모아봄에서 메시지 수신:
```javascript
// WindowManager.js에 추가
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://cpap-mask-measurement.vercel.app') return;
  
  if (event.data.type === 'MEASUREMENT_COMPLETE') {
    feedback.action('success', '측정이 완료되었습니다!');
  }
});
```

---

## 7. 다음 단계

1. **Vercel에 앱 배포**
2. **배포 URL을 `index.php`에 업데이트**
3. **모아봄 WORK 모드에서 앱 실행 테스트**
4. **웹캠 권한 테스트**
5. **얼굴 스캔 기능 개발 시작**

---

## 8. 문제 해결

### iframe이 로드되지 않는 경우:
- X-Frame-Options 헤더 확인
- 브라우저 콘솔에서 에러 메시지 확인
- HTTPS 사용 여부 확인

### 웹캠이 작동하지 않는 경우:
- iframe의 `allow` 속성 확인
- HTTPS 사용 여부 확인
- 브라우저 권한 설정 확인

### CORS 에러가 발생하는 경우:
- Vercel 헤더 설정 확인
- API 엔드포인트의 CORS 설정 확인

---

## 참고 자료

- [MediaPipe Face Mesh](https://google.github.io/mediapipe/solutions/face_mesh.html)
- [Three.js 문서](https://threejs.org/docs/)
- [Vercel 배포 가이드](https://vercel.com/docs)
- [Supabase 문서](https://supabase.com/docs)
- [iframe 보안 설정](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options)
