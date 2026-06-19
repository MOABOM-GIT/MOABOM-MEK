/**
 * IdleScreen Component
 * 대기 화면 (측정 시작 전)
 */

interface IdleScreenProps {
  hasUser: boolean;
  hasFaceLandmarker: boolean;
  cameraStarting: boolean;
  onStartCamera: () => void;
  userName?: string | null;
}

export default function IdleScreen({ 
  hasUser, 
  hasFaceLandmarker, 
  cameraStarting, 
  onStartCamera,
  userName
}: IdleScreenProps) {
  return (
    <div className="absolute inset-0 flex flex-col">
      {/* 스크롤 가능한 컨텐츠 영역 */}
      <div className="flex-1 overflow-y-auto pt-28 pb-6 px-6 flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold mb-2 text-moa-main">
          SmartCare AI
        </h1>
        <p className="text-moa-text-secondary mb-8 text-center max-w-md">
          {userName ? `${userName}님의 정확한 양압기 마스크 추천을 위해` : '정확한 양압기 마스크 추천을 위해'}<br />3D 안면 분석을 시작합니다.
        </p>
        <div className="space-y-4 w-full max-w-md">
          <div className="glass-panel p-4">
            <h3 className="text-base font-semibold text-moa-text-secondary mb-2 flex items-center gap-2">
              <i className="ri-information-line"></i> 측정 가이드
            </h3>
            <ul className="text-sm text-moa-text-tertiary space-y-2 list-none pl-0">
              <li className="flex items-start gap-2">
                <i className="ri-lightbulb-line mt-0.5"></i>
                <span>밝은 곳에서 촬영해주세요</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="ri-glasses-line mt-0.5"></i>
                <span>모자나 안경을 벗어주세요</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="ri-scan-2-line mt-0.5"></i>
                <span>정면과 측면 측정이 진행됩니다</span>
              </li>
            </ul>
          </div>

          <button
            onClick={onStartCamera}
            disabled={!hasFaceLandmarker || cameraStarting}
            className="btn btn-lg is-lv1 w-full text-white font-bold"
          >
            {cameraStarting ? (
              <>
                <i className="ri-loader-4-line animate-spin"></i>
                카메라 연결 중...
              </>
            ) : hasFaceLandmarker ? (
              <>
                <i className="ri-camera-line"></i>
                측정 시작하기
              </>
            ) : (
              <>
                <i className="ri-loader-4-line animate-spin"></i>
                AI 모델 로딩 중...
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
