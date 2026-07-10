import { useCallback, useEffect, useState } from 'react';
import {
  fetchGeneratedAppRevisions,
  restoreGeneratedAppRevision,
  type GeneratedAppRevisionSummary,
  type StoredGeneratedApp,
} from '../../../api/moabomAppsApi';
import type { LiquidGlassBackdropTone } from '../../../components/composite/liquidGlassBackdropTone';
import { Button } from '../../../components/basic/Button';
import { Div } from '../../../components/basic/Div';
import { Span } from '../../../components/basic/Span';
import { GeneratedAppSidePanelShell } from '../GeneratedAppSidePanelShell';

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export interface GeneratedAppVersionHistoryPanelProps {
  serverId: number;
  open: boolean;
  backdropTone: LiquidGlassBackdropTone | null | undefined;
  onClose: () => void;
  onRestored: (app: StoredGeneratedApp) => void;
  t: TranslateFn;
}

function formatRevisionWhen(createdAt: string | null | undefined): string {
  if (!createdAt) {
    return '';
  }
  try {
    return new Date(createdAt).toLocaleString();
  } catch {
    return createdAt;
  }
}

function sourceLabel(source: string, t: TranslateFn): string {
  const key = `moa_apps_ai.versions.source_${source}`;
  const label = t(key);
  return label === key ? source : label;
}

export function GeneratedAppVersionHistoryPanel({
  serverId,
  open,
  backdropTone,
  onClose,
  onRestored,
  t,
}: GeneratedAppVersionHistoryPanelProps) {
  const [revisions, setRevisions] = useState<GeneratedAppRevisionSummary[]>([]);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchGeneratedAppRevisions(serverId);
      setRevisions(Array.isArray(data.revisions) ? data.revisions : []);
      setCurrentVersion(typeof data.current_version === 'number' ? data.current_version : 1);
    } catch (err) {
      setRevisions([]);
      setError(err instanceof Error ? err.message : t('moa_apps_ai.versions.load_error'));
    } finally {
      setIsLoading(false);
    }
  }, [serverId, t]);

  useEffect(() => {
    if (!open) {
      setRestoringId(null);
      setError('');
      return;
    }
    void load();
  }, [open, load]);

  const handleRestore = async (revisionId: number) => {
    if (restoringId !== null) {
      return;
    }
    setRestoringId(revisionId);
    setError('');
    try {
      const app = await restoreGeneratedAppRevision(serverId, revisionId);
      onRestored(app);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('moa_apps_ai.versions.restore_error'));
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <GeneratedAppSidePanelShell
      open={open}
      title={t('moa_apps_ai.versions.title')}
      closeLabel={t('moa_apps_ai.versions.close')}
      backdropTone={backdropTone}
      onClose={onClose}
      meta={t('moa_apps_ai.versions.current', { version: currentVersion })}
    >
      {error ? <Div className="generated-app-side-panel__error" role="alert">{error}</Div> : null}
      {isLoading ? (
        <Div className="generated-app-side-panel__empty">{t('moa_apps_ai.versions.loading')}</Div>
      ) : revisions.length === 0 ? (
        <Div className="generated-app-side-panel__empty">{t('moa_apps_ai.versions.empty')}</Div>
      ) : (
        <Div className="generated-app-side-panel__list" role="list">
          {revisions.map((revision) => {
            const when = formatRevisionWhen(revision.created_at);
            return (
              <Div key={revision.id} className="generated-app-side-panel__row" role="listitem">
                <Div className="generated-app-side-panel__row-main">
                  <Span className="generated-app-side-panel__row-title">
                    #{revision.revision_number}
                    <Span className="generated-app-side-panel__row-sep" aria-hidden>
                      ·
                    </Span>
                    {sourceLabel(revision.source, t)}
                  </Span>
                  {when ? (
                    <Span className="generated-app-side-panel__row-sub">{when}</Span>
                  ) : null}
                </Div>
                <Button
                  type="button"
                  variant="neutral"
                  size="xs"
                  className="generated-app-side-panel__row-action"
                  disabled={restoringId !== null}
                  onClick={() => void handleRestore(revision.id)}
                >
                  {restoringId === revision.id
                    ? t('moa_apps_ai.versions.restoring')
                    : t('moa_apps_ai.versions.restore')}
                </Button>
              </Div>
            );
          })}
        </Div>
      )}
    </GeneratedAppSidePanelShell>
  );
}
