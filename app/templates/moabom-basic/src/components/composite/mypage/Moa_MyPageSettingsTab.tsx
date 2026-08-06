import React, { useEffect, useMemo, useState } from 'react';
import type { MoabomTranslateFn } from '../../../i18n/moabomT';
import { Button, type ButtonProps } from '../../basic/Button';
import { Div } from '../../basic/Div';
import { Icon } from '../../basic/Icon';
import { Input } from '../../basic/Input';
import { Span } from '../../basic/Span';
import type { MoabomFontSizeLevel, MoabomSystemChoice, MoabomSystemOptionConfig, MoabomSystemOptions, MoabomSystemState } from '../../../types/moabomSystem';
import { isHapticSupportedEnvironment } from '../../../runtime/env';
import { FONT_SIZE_LEVEL_PX } from '../../../utils/moabomSystemStore';

import type { PointColorPresetItem } from './myPageConstants';
import { Img } from '../../basic/Img';
import { isMoabomCustomBackgroundUuid, moabomUploadedBackgroundUrl } from '../../../utils/moBackgroundAssets';
import { APP_STACK_CLASS } from '../../../apps/appShellTypography';
import { GROUP_PANEL, MY_PAGE_BLOCK_TITLE_CLASS } from './myPageStyles';
import AppLoadingSpinner from '../AppLoadingSpinner';
import { useWeatherStatusLabel } from '../../../runtime/weather/useWeatherStatusLabel';
import { prefetchWeatherEffectChunk } from '../../../runtime/weather/weatherEffectChunkPrefetch';
import { registerMoabomFcmDeviceToken } from '../../../runtime/moabomFcmClient';

interface MyPageSettingsTabProps {
  t: MoabomTranslateFn;
  systemState: MoabomSystemState;
  languages: MoabomSystemChoice[];
  themes: MoabomSystemChoice[];
  /** hex + 선택적 presetId(i18n `moa_mypage.settings_ui.point_preset.{id}`). 서버 문자열 목록만 올 경우 presetId 없음 */
  pointPresetChoices: readonly PointColorPresetItem[];
  /**
   * 홈 배경 썸네일·선택에 사용 (관리자 업로드 목록 중 **현재 테마 모드로 필터된 UUID** 배열).
   * 호출측(Moa_MyPageWindowContent) 이 현재 테마에 따라 `deriveMoabomBackgroundImageChoicesByMode` 결과를 넘긴다.
   */
  backgroundImageIds: readonly string[];
  /**
   * 포인트 컬러 hex → 배경 UUID 바인딩 맵.
   * 사용자가 팔레트에서 색을 클릭하면, 매핑이 있을 경우 해당 배경도 자동 선택된다.
   * 키는 소문자 `#rrggbb`.
   */
  pointColorToBackgroundId?: Readonly<Record<string, string>>;
  systemOptions: MoabomSystemOptionConfig[];
  marketingConsent: {
    marketingEnabled: boolean;
    marketingAvailable: boolean;
    marketingLoading: boolean;
    marketingSaving: boolean;
    setMarketingConsent: (enabled: boolean) => Promise<void>;
  };
  onChange: (next: MoabomSystemState) => void;
}

const OPTION_BUTTON_BASE = 'w-full';

const FONT_SIZE_LEVELS: readonly MoabomFontSizeLevel[] = [1, 2, 3, 4, 5];
type PushPermissionState = NotificationPermission | 'unsupported';

const POINT_SELECTED_CHECK_CLASSES =
  'pointer-events-none absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 text-base text-white drop-shadow-[0_1px_2px_rgb(0_0_0/55%)]';

function optionButtonVariant(active: boolean): ButtonProps['variant'] {
  return active ? 'primary' : 'primary-outline';
}

function optionButtonClass(extraClass = ''): string {
  return [OPTION_BUTTON_BASE, extraClass]
    .filter(Boolean)
    .join(' ');
}

const SettingSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Div className={`${GROUP_PANEL} p-5`}>
    <Div className={MY_PAGE_BLOCK_TITLE_CLASS}>{title}</Div>
    {children}
  </Div>
);

const ToggleRow: React.FC<{ label: React.ReactNode; active: boolean; disabled?: boolean; onClick: () => void }> = ({
  label,
  active,
  disabled = false,
  onClick,
}) => (
  <Button
    onClick={onClick}
    variant="dark-outline"
    size="large"
    className="w-full"
    style={{ justifyContent: 'space-between' }}
    disabled={disabled}
  >
    <Span className="flex-1 text-left">{label}</Span>
    <ToggleIndicator active={active} />
  </Button>
);

const ToggleIndicator: React.FC<{ active: boolean }> = ({ active }) => (
  <Span
    className={`relative h-6 w-11 rounded-full transition-colors ${active ? '' : 'bg-slate-300 dark:bg-slate-600'}`}
    style={active ? { background: 'var(--moa-point-color)' } : undefined}
  >
    <Span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-[left] ${active ? 'left-6' : 'left-1'}`} />
  </Span>
);

function canonicalHex(hex: string): string {
  return hex.trim().toLowerCase();
}

function readPushPermission(): PushPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export const MyPageSettingsTab: React.FC<MyPageSettingsTabProps> = ({
  t,
  systemState,
  languages,
  themes,
  pointPresetChoices,
  backgroundImageIds,
  pointColorToBackgroundId,
  systemOptions,
  marketingConsent,
  onChange,
}) => {
  const updateState = (patch: Partial<MoabomSystemState>) => {
    onChange({
      ...systemState,
      ...patch,
      layout: {
        ...systemState.layout,
        ...patch.layout,
      },
      appearance: {
        ...systemState.appearance,
        ...patch.appearance,
      },
      preferences: {
        ...systemState.preferences,
        ...patch.preferences,
        systemOptions: {
          ...systemState.preferences.systemOptions,
          ...patch.preferences?.systemOptions,
        },
      },
    });
  };

  /**
   * 포인트 컬러 선택 시 해당 색에 바인딩된 배경이 있으면 배경도 함께 전환한다.
   * 바인딩이 없으면 배경은 그대로 유지 (단독 포인트 컬러 변경).
   */
  const applyPointColor = (hex: string) => {
    const canonical = canonicalHex(hex);
    const nextBackgroundId = pointColorToBackgroundId?.[canonical];

    if (nextBackgroundId && nextBackgroundId !== systemState.appearance.backgroundImageId) {
      updateState({
        appearance: {
          ...systemState.appearance,
          pointColor: canonical,
          backgroundImageId: nextBackgroundId,
        },
      });
      return;
    }

    updateState({
      appearance: {
        ...systemState.appearance,
        pointColor: canonical,
      },
    });
  };

  const availableLanguages = languages.filter(item => item.enabled);
  const availableThemes = themes.filter(item => item.enabled);
  const currentHex = canonicalHex(systemState.appearance.pointColor);
  const presetHexSet = useMemo(
    () => new Set(pointPresetChoices.map(c => canonicalHex(c.hex))),
    [pointPresetChoices],
  );
  const isCustomColorActive = !presetHexSet.has(currentHex);

  /**
   * Req 12.1 / 12.2 — iOS 계열 환경에서는 `haptic` 옵션을 렌더 목록에서 제거한다.
   *
   * - `isHapticSupportedEnvironment()` 는 마운트 시점에 한 번만 평가한다(UA 는 세션 중 바뀌지 않는다).
   * - 필터는 id 가 `'haptic'` 이고 지원 불가한 경우에만 제외하며, 다른 옵션은 영향 없음.
   * - 저장값(`systemState.preferences.systemOptions.haptic`) 은 건드리지 않으므로
   *   토글이 숨겨진 상태에서도 해당 값은 그대로 보존된다.
   */
  const hapticSupported = useMemo(() => isHapticSupportedEnvironment(), []);
  const visibleSystemOptions = useMemo(() => {
    const seen = new Set<string>();

    return systemOptions.filter((option) => {
      if (seen.has(option.id)) return false;
      seen.add(option.id);

      return option.id !== 'notification_center'
        && option.id !== 'toast'
        && option.id !== 'push'
        && (option.id !== 'haptic' || hapticSupported);
    });
  }, [systemOptions, hapticSupported]);
  const notificationCenterOption = systemOptions.find(option => option.id === 'notification_center');
  const toastOption = systemOptions.find(option => option.id === 'toast');
  const pushOption = systemOptions.find(option => option.id === 'push');
  const notificationCenterActive = notificationCenterOption?.user_editable === false
    ? (
      notificationCenterOption.on_by_default
      ?? notificationCenterOption.default
      ?? systemState.preferences.systemOptions.notification_center
    )
    : systemState.preferences.systemOptions.notification_center;
  const toastActive = toastOption?.user_editable === false
    ? (toastOption.on_by_default ?? toastOption.default ?? systemState.preferences.systemOptions.toast)
    : systemState.preferences.systemOptions.toast;
  const pushActive = pushOption?.user_editable === false
    ? (pushOption.on_by_default ?? pushOption.default ?? systemState.preferences.systemOptions.push)
    : systemState.preferences.systemOptions.push;
  const [pushPermission, setPushPermission] = useState<PushPermissionState>(readPushPermission);

  const setSystemOption = (id: keyof MoabomSystemOptions, active: boolean) => {
    updateState({
      preferences: {
        ...systemState.preferences,
        systemOptions: {
          ...systemState.preferences.systemOptions,
          [id]: active,
        },
      },
    });
  };

  const handlePushToggle = async () => {
    const rawActive = systemState.preferences.systemOptions.push;
    if (rawActive && pushPermission !== 'default') {
      setSystemOption('push', false);
      return;
    }
    if (pushPermission === 'unsupported' || pushPermission === 'denied') {
      return;
    }

    let permission = pushPermission;
    if (permission === 'default') {
      try {
        permission = await Notification.requestPermission();
      } catch {
        permission = Notification.permission;
      }
      setPushPermission(permission);
    }

    const enabled = permission === 'granted';
    setSystemOption('push', enabled);
    if (enabled) {
      void registerMoabomFcmDeviceToken({ userInitiated: true });
    }
  };

  useEffect(() => {
    prefetchWeatherEffectChunk();
  }, []);

  useEffect(() => {
    const syncPermission = () => setPushPermission(readPushPermission());
    window.addEventListener('focus', syncPermission);
    document.addEventListener('visibilitychange', syncPermission);

    return () => {
      window.removeEventListener('focus', syncPermission);
      document.removeEventListener('visibilitychange', syncPermission);
    };
  }, []);

  /*
   * 날씨 토글 옆 현재 상태 텍스트("흐림 · 14°C"). 토글이 켜지고(애니메이션 잠김 제외)
   * 스냅샷 캐시가 있을 때만 값을 돌려준다. 추가 HTTP 호출 없이 캐시만 읽으며,
   * weather/current API 가 실제로 연결됐는지 눈으로 확인하는 테스트 보조용이다.
   */
  const weatherToggleActive =
    systemState.preferences.systemOptions.weather === true
    && systemState.preferences.systemOptions.animation !== false;
  const weatherStatus = useWeatherStatusLabel(t, weatherToggleActive, systemState.preferences.language);

  return (
    <Div className={APP_STACK_CLASS}>
      <SettingSection title={t('moa_mypage.settings_ui.section_language')}>
        <Div className="moa-mypage-option-grid grid grid-cols-4 gap-2">
          {availableLanguages.map(({ id, label }) => (
            <Button
              key={id}
              onClick={() => updateState({ preferences: { ...systemState.preferences, language: id as MoabomSystemState['preferences']['language'] } })}
              variant={optionButtonVariant(systemState.preferences.language === id)}
              size="medium"
              className={optionButtonClass()}
            >
              {label}
            </Button>
          ))}
        </Div>
      </SettingSection>

      <SettingSection title={t('moa_mypage.settings_ui.section_theme')}>
        <Div className="moa-mypage-option-grid grid grid-cols-4 gap-2">
          {availableThemes.map(({ id, label }) => (
            <Button
              key={id}
              onClick={() => updateState({ appearance: { ...systemState.appearance, theme: id as MoabomSystemState['appearance']['theme'] } })}
              variant={optionButtonVariant(systemState.appearance.theme === id)}
              size="medium"
              className={optionButtonClass('gap-2')}
              aria-label={t('moa_mypage.settings_ui.theme_aria', { label })}
              title={t('moa_mypage.settings_ui.theme_title', { label })}
            >
              <Icon name={id.includes('dark') ? 'moon' : 'sun'} />
              {id.includes('flat') ? <Icon name="battery-half" /> : null}
            </Button>
          ))}
        </Div>
      </SettingSection>

      <SettingSection title={t('moa_mypage.settings_ui.section_font_size')}>
        <Div className="flex items-stretch gap-2">
          {FONT_SIZE_LEVELS.map((level) => (
            <Button
              key={`moa-font-size-${level}`}
              onClick={() => updateState({ appearance: { ...systemState.appearance, fontSize: level } })}
              variant={optionButtonVariant(systemState.appearance.fontSize === level)}
              size="medium"
              className={optionButtonClass('flex-1')}
              aria-label={t('moa_mypage.settings_ui.font_size_level_aria', { level: String(level) })}
              aria-pressed={systemState.appearance.fontSize === level}
            >
              <Span style={{ fontSize: `${FONT_SIZE_LEVEL_PX[level]}px`, lineHeight: 1 }}>가</Span>
            </Button>
          ))}
        </Div>
      </SettingSection>

      <SettingSection title={t('moa_mypage.settings_ui.section_point_color')}>
        <Div className="moa-mypage-point-presets-grid">
          {pointPresetChoices.map((choice, idx) => {
            const hex = canonicalHex(choice.hex);
            const presetKey = choice.presetId ? `moa_mypage.settings_ui.point_preset.${choice.presetId}` : null;
            const labelForAria = presetKey ? t(presetKey) : t('moa_mypage.settings_ui.color_aria', { color: choice.hex });
            const selected = currentHex === hex;
            return (
              <Div key={`moa-point-choice-${idx}`} className="moa-mypage-point-presets-cell flex justify-center items-center">
                <Button
                  type="button"
                  onClick={() => applyPointColor(choice.hex)}
                  className="relative h-11 w-11 shrink-0 cursor-pointer rounded-full border-0 p-0 hover:opacity-95 moa-mypage-point-swatch"
                  style={{ background: choice.hex }}
                  aria-label={labelForAria}
                  aria-pressed={selected}
                >
                  {selected ? (
                    <Icon name="check" className={POINT_SELECTED_CHECK_CLASSES} aria-hidden />
                  ) : null}
                </Button>
              </Div>
            );
          })}
          <Div className="moa-mypage-point-presets-cell flex justify-center items-center">
            <Div
              className={`relative flex h-11 w-11 shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-full border-0 moa-mypage-point-custom-swatch ${isCustomColorActive ? '' : 'bg-white shadow-sm'}`}
            >
              {isCustomColorActive ? (
                <>
                  <Div
                    className="absolute inset-0"
                    style={{ background: systemState.appearance.pointColor }}
                    aria-hidden
                  />
                  <Icon name="check" className={POINT_SELECTED_CHECK_CLASSES} aria-hidden />
                </>
              ) : (
                <Icon
                  name="palette"
                  className="pointer-events-none relative z-[1] text-lg text-muted shrink-0 dark:text-muted"
                  aria-hidden
                />
              )}
              <Input
                type="color"
                value={systemState.appearance.pointColor}
                onChange={(e) => applyPointColor(e.target.value)}
                className="absolute inset-0 z-[2] h-full w-full cursor-pointer opacity-0"
                aria-label={t('moa_mypage.settings_ui.custom_color_aria')}
              />
            </Div>
          </Div>
        </Div>
      </SettingSection>

      <SettingSection title={t('moa_mypage.settings_ui.section_background')}>
        {backgroundImageIds.length === 0 ? (
          <Div className="text-sm text-muted">
            {t('moa_mypage.settings_ui.background_empty')}
          </Div>
        ) : (
          <Div className="moa-mypage-bg-presets-grid">
            {backgroundImageIds.map((bgId) => {
              const src = isMoabomCustomBackgroundUuid(bgId) ? moabomUploadedBackgroundUrl(bgId, 'thumb') : '';
              const selected = systemState.appearance.backgroundImageId === bgId;
              return (
                <Div key={`moa-bg-${bgId}`} className="flex justify-center items-center">
                  <Button
                    type="button"
                    onClick={() =>
                      updateState({
                        appearance: {
                          ...systemState.appearance,
                          backgroundImageId: bgId,
                        },
                      })
                    }
                    className={`moa-mypage-bg-thumb relative h-14 w-full max-w-[4.5rem] overflow-hidden rounded-lg border-2 p-0 shadow-sm ${
                      selected ? 'border-[rgb(var(--moa-point-rgb))]' : 'border-white/70 dark:border-white/25'
                    }`}
                    aria-label={t('moa_mypage.settings_ui.bg_thumb_aria', { n: bgId })}
                    aria-pressed={selected}
                  >
                    <Img
                      src={src}
                      alt=""
                      className="moa-mypage-bg-thumb-img h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    {selected ? (
                      <Icon name="check" className={POINT_SELECTED_CHECK_CLASSES} aria-hidden />
                    ) : null}
                  </Button>
                </Div>
              );
            })}
          </Div>
        )}
      </SettingSection>

      <SettingSection title={t('moa_mypage.settings_ui.section_system_options')}>
        <Div className="moa-mypage-system-grid grid grid-cols-2 gap-2">
          {visibleSystemOptions.map(option => {
            const rawActive = systemState.preferences.systemOptions[option.id];
            /*
             * animation · weather 연동(사용자 요청): animation 이 꺼져 있으면 weather 효과도
             * 시각적으로 꺼진 것처럼 표시하고 조작을 막는다. 저장값(rawActive) 은 유지하므로
             * animation 을 다시 켰을 때 사용자의 이전 선택이 그대로 살아난다.
             */
            const animationOff = systemState.preferences.systemOptions.animation === false;
            const isWeatherLockedByAnimation = option.id === 'weather' && animationOff;
            const visualActive = isWeatherLockedByAnimation ? false : rawActive;
            const disabled = !option.user_editable || isWeatherLockedByAnimation;
            const toggleOption = () => {
              if (disabled) return;
              updateState({
                preferences: {
                  ...systemState.preferences,
                  systemOptions: {
                    ...systemState.preferences.systemOptions,
                    [option.id]: !rawActive,
                  } as MoabomSystemOptions,
                },
              });
            };

            let label: React.ReactNode = option.label;
            if (option.id === 'weather' && weatherToggleActive) {
              if (weatherStatus.label) {
                label = (
                  <Span className="inline-flex items-center gap-2">
                    <Span>{option.label}</Span>
                    <Span className="text-xs font-normal text-muted">({weatherStatus.label})</Span>
                  </Span>
                );
              } else if (weatherStatus.loading) {
                label = (
                  <Span className="inline-flex items-center gap-2">
                    <Span>{option.label}</Span>
                    <AppLoadingSpinner
                      compact
                      hideLabel
                      label={t('moa_mypage.weather_status.loading')}
                    />
                  </Span>
                );
              }
            }

            return (
              <ToggleRow
                key={option.id}
                label={label}
                active={visualActive}
                disabled={disabled}
                onClick={toggleOption}
              />
            );
          })}
        </Div>
      </SettingSection>

      <SettingSection title={t('moa_mypage.settings_ui.section_notifications')}>
        <Div className="grid grid-cols-1 gap-2">
          <ToggleRow
            label={t('moa_mypage.notifications.center_label')}
            active={notificationCenterActive}
            disabled={notificationCenterOption?.user_editable === false}
            onClick={() => setSystemOption(
              'notification_center',
              !systemState.preferences.systemOptions.notification_center,
            )}
          />
          <ToggleRow
            label={toastOption?.label || t('moa_mypage.system_options.toast')}
            active={toastActive}
            disabled={toastOption?.user_editable === false}
            onClick={() => setSystemOption(
              'toast',
              !systemState.preferences.systemOptions.toast,
            )}
          />
          <ToggleRow
            label={(
              <Span>
                {pushOption?.label || t('moa_mypage.system_options.push')}
                {' ('}
                {t(`moa_mypage.notifications.push_status.${pushPermission}`)}
                {')'}
              </Span>
            )}
            active={pushActive}
            disabled={
              pushOption?.user_editable === false
              || (
                !systemState.preferences.systemOptions.push
                && (pushPermission === 'unsupported' || pushPermission === 'denied')
              )
            }
            onClick={() => {
              void handlePushToggle();
            }}
          />
          {(marketingConsent.marketingAvailable || marketingConsent.marketingLoading) ? (
            <ToggleRow
              label={t('moa_mypage.notifications.marketing_label')}
              active={marketingConsent.marketingEnabled}
              disabled={marketingConsent.marketingLoading || marketingConsent.marketingSaving}
              onClick={() => {
                void marketingConsent.setMarketingConsent(!marketingConsent.marketingEnabled);
              }}
            />
          ) : null}
        </Div>
      </SettingSection>
    </Div>
  );
};
