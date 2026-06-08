import React, { useEffect, useRef, useState } from 'react';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import { Div } from '../basic/Div';
import { Button } from '../basic/Button';
import { Icon } from '../basic/Icon';
import { Span } from '../basic/Span';
import { MODES } from '../../data/Moa_navigation';

export interface ModeSelectorProps {
  /** 현재 선택된 모드 인덱스 */
  modeIdx: number;
  /** 모드 변경 핸들러 */
  onModeChange: (idx: number) => void;
  /** 모바일 오버레이 헤더 축소 여부 */
  compact?: boolean;
}

/**
 * ModeSelector 컴포넌트
 *
 * 중앙 패널 헤더의 모드 선택 드롭다운입니다.
 * SMARTCARE APPS / SITES / WORK 모드를 전환합니다.
 */
export const ModeSelector: React.FC<ModeSelectorProps> = ({ modeIdx, onModeChange, compact = false }) => {
  const { t } = useMoabomShellT();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentMode = MODES[modeIdx];

  return (
    <Div ref={dropdownRef} className="relative">
      <Button
        onClick={() => setOpen(v => !v)}
        className={`justify-center flex items-center gap-2 px-3 py-1 rounded-xl border-0 transition-all cursor-pointer ${
          open ? 'bg-white/70 dark:bg-white/12' : 'hover:bg-white/50 dark:hover:bg-white/10'
        }`}
      >
        <Icon name={currentMode.icon} className="text-sm translate-y-px" style={{ color: 'var(--moa-point-color)' }} />
        <Span className={`font-bold text-secondary tracking-tight ${compact ? 'text-sm' : 'text-base'}`}>{t(`moa_shell.modes.${currentMode.id}.name`)}</Span>
        <Icon
          name="chevron-down"
          className={`text-faint text-xs transition-transform duration-200 translate-y-px ${open ? 'rotate-180' : ''}`}
        />
      </Button>

      {/* 드롭다운 메뉴 */}
      <Div
        className={`glass-sm-blur absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[260px] p-2 rounded-2xl z-50 transition-all duration-200 ${
          open ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'
        }`}
        style={{
          boxShadow: '0 10px 40px rgba(0,0,0,0.1), 0 2px 10px rgba(0,0,0,0.05)'
        }}
      >
        {MODES.map((mode, idx) => (
          <Button
            key={mode.id}
            onClick={() => {
              onModeChange(idx);
              setOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-0 mb-1 last:mb-0 transition-all cursor-pointer ${
              modeIdx === idx
                ? 'moa-point-fill text-white'
                : 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-600/35'
            }`}
          >
            <Div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                modeIdx === idx ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700/55'
              }`}
            >
              <Icon name={mode.icon} className={`text-lg ${modeIdx === idx ? 'text-white' : 'text-muted'}`} />
            </Div>
            <Div className="flex-1 text-left min-w-0">
              <Div className={`font-bold text-sm ${modeIdx === idx ? 'text-white' : 'text-secondary'}`}>
                {t(`moa_shell.modes.${mode.id}.name`)}
              </Div>
              <Div className={`text-xs ${modeIdx === idx ? 'text-white/70' : 'text-faint'}`}>
                {t(`moa_shell.modes.${mode.id}.desc`)}
              </Div>
            </Div>
            {modeIdx === idx && <Icon name="check" className="text-white text-sm shrink-0" />}
          </Button>
        ))}
      </Div>
    </Div>
  );
};
