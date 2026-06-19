/**
 * SurveyScreen Component
 * 설문 조사 화면
 */

import type { UserProfile } from '../types';

interface SurveyScreenProps {
  userProfile: UserProfile;
  onProfileChange: (profile: UserProfile) => void;
  onNext: () => void;
  userName?: string | null;
}

export default function SurveyScreen({ userProfile, onProfileChange, onNext, userName }: SurveyScreenProps) {
  return (
    <div className="absolute inset-0 flex flex-col">
      {/* 스크롤 가능한 컨텐츠 영역 */}
      <div className="flex-1 overflow-y-auto pt-28 pb-6 px-6">
        <div className="flex flex-col items-center">
          <h1 className="text-2xl font-bold mb-2 text-moa-main">
            SmartCare AI
          </h1>
          <p className="text-moa-text-secondary mb-6 text-center text-sm">
            {userName ? `${userName}님, 정확한 마스크 추천을 위해 몇 가지 질문에 답해주세요` : '정확한 마스크 추천을 위해 몇 가지 질문에 답해주세요'}
          </p>

          <div className="w-full max-w-md space-y-6">
            {/* 성별 */}
            <div className="glass-panel p-4">
              <h3 className="text-sm font-semibold text-moa-text-secondary mb-3 flex items-center gap-2">
                <i className="ri-user-line"></i> 성별
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={() => onProfileChange({...userProfile, gender: 'male'})}
                  className={`btn btn-md flex-1 font-medium ${
                    userProfile.gender === 'male' ? 'is-lv1 active' : 'is-lv2'
                  }`}
                >
                  남성
                </button>
                <button
                  onClick={() => onProfileChange({...userProfile, gender: 'female'})}
                  className={`btn btn-md flex-1 font-medium ${
                    userProfile.gender === 'female' ? 'is-lv1 active' : 'is-lv2'
                  }`}
                >
                  여성
                </button>
              </div>
            </div>

            {/* 연령대 */}
            <div className="glass-panel p-4">
              <h3 className="text-sm font-semibold text-moa-text-secondary mb-3 flex items-center gap-2">
                <i className="ri-calendar-line"></i> 연령대
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {(['20s', '30s', '40s', '50s', '60+'] as const).map((age) => (
                  <button
                    key={age}
                    onClick={() => onProfileChange({...userProfile, ageGroup: age})}
                    className={`btn btn-sm font-medium ${
                      userProfile.ageGroup === age ? 'is-lv1 active' : 'is-lv2'
                    }`}
                  >
                    {age === '60+' ? '60대+' : age.replace('s', '대')}
                  </button>
                ))}
              </div>
            </div>

            {/* 수면 습관 */}
            <div className="glass-panel p-4">
              <h3 className="text-sm font-semibold text-moa-text-secondary mb-3 flex items-center gap-2">
                <i className="ri-zzz-line"></i> 수면 중 뒤척임
              </h3>
              <div className="flex gap-3">
                {(['low', 'medium', 'high'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => onProfileChange({...userProfile, tossing: level})}
                    className={`btn btn-md flex-1 font-medium ${
                      userProfile.tossing === level ? 'is-lv1 active' : 'is-lv2'
                    }`}
                  >
                    {level === 'low' ? '적음' : level === 'medium' ? '보통' : '많음'}
                  </button>
                ))}
              </div>
            </div>

            {/* 구강호흡 */}
            <div className="glass-panel p-4">
              <h3 className="text-sm font-semibold text-moa-text-secondary mb-3 flex items-center gap-2">
                <i className="ri-lungs-line"></i> 수면 중 구강호흡
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={() => onProfileChange({...userProfile, mouthBreathing: true})}
                  className={`btn btn-md flex-1 font-medium ${
                    userProfile.mouthBreathing ? 'is-lv1 active' : 'is-lv2'
                  }`}
                >
                  예
                </button>
                <button
                  onClick={() => onProfileChange({...userProfile, mouthBreathing: false})}
                  className={`btn btn-md flex-1 font-medium ${
                    !userProfile.mouthBreathing ? 'is-lv1 active' : 'is-lv2'
                  }`}
                >
                  아니오
                </button>
              </div>
            </div>

            {/* 압력 수치 */}
            <div className="glass-panel p-4">
              <h3 className="text-sm font-semibold text-moa-text-secondary mb-3 flex items-center gap-2">
                <i className="ri-windy-line"></i> 양압기 압력 (cmH2O)
              </h3>
              <div className="flex gap-3">
                {(['low', 'medium', 'high'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => onProfileChange({...userProfile, pressure: level})}
                    className={`btn btn-md flex-1 font-medium ${
                      userProfile.pressure === level ? 'is-lv1 active' : 'is-lv2'
                    }`}
                  >
                    {level === 'low' ? '10 이하' : level === 'medium' ? '10-15' : '15 이상'}
                  </button>
                ))}
              </div>
            </div>

            {/* 선호 마스크 */}
            <div className="glass-panel p-4">
              <h3 className="text-sm font-semibold text-moa-text-secondary mb-2 flex items-center gap-2">
                <i className="ri-mask-line"></i> 선호 마스크 타입 (복수선택)
              </h3>
              <p className="text-xs text-moa-text-tertiary mb-3">관심있는 타입을 모두 선택하세요</p>
              <div className="space-y-2">
                {[
                  { type: 'nasal' as const, label: '나잘 (코만 덮음)', desc: '청장년층에 적합', icon: 'ri-lungs-line' },
                  { type: 'pillow' as const, label: '필로우 (콧구멍만)', desc: '가볍고 편안함, 저압력용', icon: 'ri-contrast-drop-line' },
                  { type: 'full' as const, label: '풀페이스 (코+입)', desc: '구강호흡자, 중노년층', icon: 'ri-user-smile-line' }
                ].map(({ type, label, desc, icon }) => (
                  <button
                    key={type}
                    onClick={() => {
                      const current = userProfile.preferredTypes;
                      const updated = current.includes(type)
                        ? current.filter(t => t !== type)
                        : [...current, type];
                      onProfileChange({...userProfile, preferredTypes: updated});
                    }}
                    className={`w-full p-4 rounded-lg text-left transition-all ${
                      userProfile.preferredTypes.includes(type)
                        ? 'bg-moa-main text-white box-shadow-[var(--color-shadow-lv2),_0_0_0_rgba(0,0,0,0),_inset_0_1px_0_var(--layout-max-lv3)]' 
                        : 'bg-moa-bg text-moa-text-secondary hover:bg-moa-main hover:text-white backdrop-filter-[var(--layout-blur)]'
                    }`}
                    style={{
                      backdropFilter: 'var(--layout-blur)',
                      boxShadow: userProfile.preferredTypes.includes(type) 
                        ? 'var(--color-shadow-lv2), 0 0 0 rgba(0,0,0,0), inset 0 1px 0 var(--layout-max-lv3)'
                        : 'var(--dark-shadow-lv2), 0 0 0 rgba(0,0,0,0), inset 0 1px 0 var(--layout-max-lv3)'
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <i className={icon}></i>
                        <div>
                          <div className="font-medium text-sm">{label}</div>
                          <div className="text-xs opacity-70 mt-0.5">{desc}</div>
                        </div>
                      </div>
                      {userProfile.preferredTypes.includes(type) && (
                        <i className="ri-check-line text-lg"></i>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 다음 버튼 */}
            <button
              onClick={onNext}
              className="btn btn-lg is-lv1 w-full text-white font-bold"
            >
              다음: 얼굴 측정 <i className="ri-arrow-right-line"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
