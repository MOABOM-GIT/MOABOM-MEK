import React from 'react';
import type { App } from '../../../data/Moa_apps';
import type { MoabomSystemLanguage } from '../../../types/moabomSystem';
import {
  parseGeneratedLibraryServerId,
} from '../../../apps/generatedAppLibrary';
import { resolveAppStrings } from '../../../i18n/resolveAppStrings';
import { Button } from '../../basic/Button';
import { Div } from '../../basic/Div';
import { Icon } from '../../basic/Icon';
import { Span } from '../../basic/Span';
import { Moa_OverflowMarqueeText } from '../Moa_OverflowMarqueeText';
import { GROUP_PANEL, MY_PAGE_BLOCK_TITLE_CLASS } from './myPageStyles';

interface LibrarySectionProps {
  title: string;
  locale: MoabomSystemLanguage;
  apps: App[];
  emptyText: string;
  appInfoFallback: string;
  onOpenApp?: (app: App) => void;
  onEditGeneratedApp?: (serverId: number) => void;
  editAriaLabel?: string;
}

export const LibrarySection: React.FC<LibrarySectionProps> = ({
  title,
  locale,
  apps,
  emptyText,
  appInfoFallback,
  onOpenApp,
  onEditGeneratedApp,
  editAriaLabel,
}) => (
  <Div className={`${GROUP_PANEL} p-5`}>
    <Div className={MY_PAGE_BLOCK_TITLE_CLASS}>{title}</Div>
    {apps.length > 0 ? (
      <Div
        className="moa-mypage-library grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))', justifyItems: 'stretch' }}
      >
        {apps.map(app => {
          const { name, description } = resolveAppStrings(app, locale);
          const desc = description.trim();
          const serverId = parseGeneratedLibraryServerId(app.id);
          const canEdit = serverId != null && onEditGeneratedApp != null;
          return (
            <Div key={app.id} className="group relative w-full max-w-[78px] min-w-0 mx-auto">
              <Button
                type="button"
                onClick={() => onOpenApp?.(app)}
                className="flex w-full flex-col items-center gap-2 rounded-xl border-0 bg-transparent p-0 hover:opacity-90 transition-all cursor-pointer"
              >
                <Div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-md" style={{ background: app.gradient }}>
                  <Icon name={app.icon} className="text-white text-xl" />
                </Div>
                <Div className="w-full min-w-0 text-center">
                  <Moa_OverflowMarqueeText
                    text={name}
                    className="text-xs font-bold text-primary text-center"
                  />
                  <Moa_OverflowMarqueeText
                    text={desc || appInfoFallback}
                    className="text-xs text-muted text-center mt-0.5"
                  />
                </Div>
              </Button>
              {canEdit ? (
                <Button
                  type="button"
                  aria-label={editAriaLabel}
                  title={editAriaLabel}
                  onClick={(event) => {
                    event.stopPropagation();
                    onEditGeneratedApp?.(serverId);
                  }}
                  className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border border-white/70 bg-white/90 text-violet-600 shadow-md opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-slate-900/90 dark:text-violet-300"
                >
                  <Icon name="edit" className="text-xs" />
                </Button>
              ) : null}
            </Div>
          );
        })}
      </Div>
    ) : (
      <Div className="py-6 text-center text-sm text-faint">{emptyText}</Div>
    )}
  </Div>
);

interface LockedLibrarySectionProps {
  title: string;
  message: string;
}

export const LockedLibrarySection: React.FC<LockedLibrarySectionProps> = ({ title, message }) => (
  <Div className={`${GROUP_PANEL} p-5`}>
    <Div className={MY_PAGE_BLOCK_TITLE_CLASS}>{title}</Div>
    <Div className="glass-sm flex items-center justify-center gap-2 rounded-2xl px-4 py-6 text-sm text-muted">
      <Icon name="lock" className="text-faint" />
      <Span>{message}</Span>
    </Div>
  </Div>
);
