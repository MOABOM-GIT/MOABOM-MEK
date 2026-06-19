/**
 * ResultScreen Component
 * 측정 결과 화면
 */

import type { MeasurementResult, MaskRecommendation } from '../types';

interface ResultScreenProps {
  result: MeasurementResult;
  recommendation: MaskRecommendation;
  onSave: () => void;
  onRetry: () => void;
}

export default function ResultScreen({ result, recommendation, onSave, onRetry }: ResultScreenProps) {
  return (
    <div className="absolute inset-0 flex flex-col z-30 animate-in fade-in slide-in-from-bottom-10 duration-500">
      {/* 스크롤 가능한 컨텐츠 영역 */}
      <div className="flex-1 overflow-y-auto pt-24 pb-6 px-6">
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 bg-moa-main/20 rounded-full flex items-center justify-center mb-6 flex-shrink-0">
            <i className="ri-check-line text-4xl text-moa-main"></i>
          </div>

          <h2 className="text-2xl font-bold text-moa-text mb-1 flex-shrink-0">측정 완료</h2>
          <p className="text-moa-text-secondary text-sm mb-8 flex-shrink-0">AI 분석 결과가 준비되었습니다.</p>

          <div className="w-full max-w-md space-y-4 flex-shrink-0">
            {/* 추천 사이즈 */}
            <div className="glass-panel p-6">
              <div className="flex justify-between items-center pb-4 border-b border-moa-bg-secondary">
                <span className="text-moa-text-secondary flex items-center gap-2">
                  <i className="ri-ruler-line"></i>
                  추천 사이즈
                </span>
                <span className="text-3xl font-bold text-moa-main">
                  {recommendation.size}
                </span>
              </div>
            </div>

            {/* 추천 마스크 타입 */}
            <div className="glass-panel p-6">
              <h3 className="text-lg font-bold text-moa-text mb-4 flex items-center gap-2">
                <i className="ri-medal-line"></i>
                추천 마스크 타입
              </h3>
              <div className="space-y-3">
                {recommendation.types.map((typeRec, idx) => (
                  <div 
                    key={typeRec.type}
                    className="flex items-center justify-between p-3 bg-moa-bg rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        idx === 0 ? 'bg-moa-main text-white' : 'bg-moa-bg-secondary text-moa-text-secondary'
                      }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-moa-text">
                          {typeRec.type === 'nasal' ? '나잘' : typeRec.type === 'pillow' ? '필로우' : '풀페이스'}
                        </div>
                        <div className="text-xs text-moa-text-tertiary">{typeRec.reasons.join(', ')}</div>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-moa-main">{typeRec.score}점</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 상세 측정값 */}
            <div className="glass-panel p-6">
              <h3 className="text-lg font-bold text-moa-text mb-4 flex items-center gap-2">
                <i className="ri-file-list-3-line"></i>
                상세 측정값
              </h3>
              <div className="space-y-4">
                {/* 정면 측정값 */}
                <div className="border-b border-moa-bg-secondary pb-3">
                  <h4 className="text-xs text-moa-text-tertiary mb-2 font-semibold">정면 측정</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-moa-bg p-3 rounded-lg">
                      <div className="text-moa-text-tertiary text-xs mb-1">코 너비</div>
                      <div className="font-semibold text-moa-text">{result.front.noseWidth}mm</div>
                    </div>
                    <div className="bg-moa-bg p-3 rounded-lg">
                      <div className="text-moa-text-tertiary text-xs mb-1">얼굴 길이</div>
                      <div className="font-semibold text-moa-text">{result.front.faceLength}mm</div>
                    </div>
                    <div className="bg-moa-bg p-3 rounded-lg">
                      <div className="text-moa-text-tertiary text-xs mb-1">얼굴 폭</div>
                      <div className="font-semibold text-moa-text">{result.front.faceWidth}mm</div>
                    </div>
                    <div className="bg-moa-bg p-3 rounded-lg">
                      <div className="text-moa-text-tertiary text-xs mb-1">미간 너비</div>
                      <div className="font-semibold text-moa-text">{result.front.bridgeWidth}mm</div>
                    </div>
                    <div className="bg-moa-bg p-3 rounded-lg">
                      <div className="text-moa-text-tertiary text-xs mb-1">인중 길이</div>
                      <div className="font-semibold text-moa-main">{result.front.philtrumLength}mm</div>
                    </div>
                    <div className="bg-moa-bg p-3 rounded-lg">
                      <div className="text-moa-text-tertiary text-xs mb-1">입 너비</div>
                      <div className="font-semibold text-moa-main">{result.front.mouthWidth}mm</div>
                    </div>
                  </div>
                </div>

                {/* 측면 측정값 */}
                <div>
                  <h4 className="text-xs text-moa-text-tertiary mb-2 font-semibold">측면 측정</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-moa-bg p-3 rounded-lg">
                      <div className="text-moa-text-tertiary text-xs mb-1">코 높이</div>
                      <div className="font-semibold text-moa-main">{result.profile.noseHeight}mm</div>
                    </div>
                    <div className="bg-moa-bg p-3 rounded-lg">
                      <div className="text-moa-text-tertiary text-xs mb-1">턱 돌출</div>
                      <div className="font-semibold text-moa-main">{result.profile.jawProjection}mm</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={onRetry}
                className="btn btn-lg is-lv2 flex-1 font-medium"
              >
                <i className="ri-restart-line"></i>
                다시 측정
              </button>
              <button
                onClick={onSave}
                className="btn btn-lg is-success flex-1 text-white font-bold"
              >
                <i className="ri-save-line"></i>
                결과 저장
              </button>
            </div>

            {/* 추가 액션 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  window.parent.postMessage({ 
                    type: 'SHOW_TOAST', 
                    message: '추천 제품 페이지로 이동합니다',
                    variant: 'info'
                  }, '*');
                }}
                className="btn btn-lg is-lv1 flex-1 text-white font-bold"
              >
                <i className="ri-shopping-bag-line"></i>
                추천 제품 보기
              </button>
              <button
                onClick={() => {
                  window.parent.postMessage({ 
                    type: 'SHOW_TOAST', 
                    message: 'PDF 리포트를 생성 중입니다',
                    variant: 'info'
                  }, '*');
                }}
                className="btn btn-lg is-lv1 flex-1 text-white font-bold"
              >
                <i className="ri-file-pdf-line"></i>
                PDF 다운로드
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
