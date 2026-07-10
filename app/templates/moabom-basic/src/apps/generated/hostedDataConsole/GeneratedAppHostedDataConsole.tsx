import { useCallback, useEffect, useState } from 'react';
import {
  deleteGeneratedAppDataRow,
  exportGeneratedAppData,
  fetchGeneratedAppDataRows,
  fetchGeneratedAppDataTables,
  type GeneratedAppDataRow,
  type GeneratedAppDataTableSummary,
} from '../../../api/moabomAppsApi';
import type { LiquidGlassBackdropTone } from '../../../components/composite/liquidGlassBackdropTone';
import { Button } from '../../../components/basic/Button';
import { Div } from '../../../components/basic/Div';
import { Span } from '../../../components/basic/Span';
import { GeneratedAppSidePanelShell } from '../GeneratedAppSidePanelShell';

type TranslateFn = (key: string) => string;

export interface GeneratedAppHostedDataConsoleProps {
  serverId: number;
  open: boolean;
  backdropTone: LiquidGlassBackdropTone | null | undefined;
  onClose: () => void;
  t: TranslateFn;
}

function summarizePayload(payload: Record<string, unknown>): string {
  try {
    const text = JSON.stringify(payload);
    return text.length > 120 ? `${text.slice(0, 120)}…` : text;
  } catch {
    return '';
  }
}

export function GeneratedAppHostedDataConsole({
  serverId,
  open,
  backdropTone,
  onClose,
  t,
}: GeneratedAppHostedDataConsoleProps) {
  const [tables, setTables] = useState<GeneratedAppDataTableSummary[]>([]);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [rows, setRows] = useState<GeneratedAppDataRow[]>([]);
  const [error, setError] = useState('');
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isLoadingRows, setIsLoadingRows] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const loadTables = useCallback(async () => {
    setIsLoadingTables(true);
    setError('');
    try {
      const next = await fetchGeneratedAppDataTables(serverId);
      setTables(next);
      setActiveTable((prev) => {
        if (prev && next.some((table) => table.table_key === prev)) {
          return prev;
        }
        return next[0]?.table_key ?? null;
      });
      if (next.length === 0) {
        setRows([]);
      }
    } catch (err) {
      setTables([]);
      setActiveTable(null);
      setRows([]);
      setError(err instanceof Error ? err.message : t('moa_apps_ai.data_console.load_error'));
    } finally {
      setIsLoadingTables(false);
    }
  }, [serverId, t]);

  useEffect(() => {
    if (!open) {
      setDeletingId(null);
      setIsExporting(false);
      setError('');
      return;
    }
    void loadTables();
  }, [open, loadTables]);

  useEffect(() => {
    if (!open || !activeTable) {
      setRows([]);
      setIsLoadingRows(false);
      return;
    }
    let cancelled = false;
    setIsLoadingRows(true);
    setError('');
    void (async () => {
      try {
        const nextRows = await fetchGeneratedAppDataRows(serverId, activeTable);
        if (!cancelled) {
          setRows(nextRows);
        }
      } catch (err) {
        if (!cancelled) {
          setRows([]);
          setError(err instanceof Error ? err.message : t('moa_apps_ai.data_console.load_error'));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRows(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, activeTable, serverId, t]);

  const handleDelete = async (rowId: number) => {
    if (!activeTable || deletingId !== null) {
      return;
    }
    setDeletingId(rowId);
    setError('');
    try {
      await deleteGeneratedAppDataRow(serverId, activeTable, rowId);
      setRows((prev) => prev.filter((row) => row.id !== rowId));
      await loadTables();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('moa_apps_ai.data_console.delete_error'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = async () => {
    if (isExporting) {
      return;
    }
    setIsExporting(true);
    setError('');
    try {
      const payload = await exportGeneratedAppData(serverId);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `generated-app-${serverId}-data.json`;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('moa_apps_ai.data_console.export_error'));
    } finally {
      setIsExporting(false);
    }
  };

  const busy = isLoadingTables || isLoadingRows || deletingId !== null || isExporting;

  return (
    <GeneratedAppSidePanelShell
      open={open}
      title={t('moa_apps_ai.data_console.title')}
      closeLabel={t('moa_apps_ai.data_console.close')}
      backdropTone={backdropTone}
      onClose={onClose}
      actions={(
        <Button
          type="button"
          variant="neutral"
          size="xs"
          disabled={busy || tables.length === 0}
          onClick={() => void handleExport()}
        >
          {isExporting ? t('moa_apps_ai.data_console.exporting') : t('moa_apps_ai.data_console.export')}
        </Button>
      )}
    >
      {error ? <Div className="generated-app-side-panel__error" role="alert">{error}</Div> : null}
      {isLoadingTables ? (
        <Div className="generated-app-side-panel__empty">{t('moa_apps_ai.data_console.loading')}</Div>
      ) : tables.length === 0 ? (
        <Div className="generated-app-side-panel__empty">{t('moa_apps_ai.data_console.empty')}</Div>
      ) : (
        <>
          <Div className="generated-app-side-panel__tabs" role="tablist" aria-label={t('moa_apps_ai.data_console.title')}>
            {tables.map((table) => {
              const selected = activeTable === table.table_key;
              return (
                <Button
                  key={table.table_key}
                  type="button"
                  size="xs"
                  variant={selected ? 'primary' : 'neutral'}
                  className="generated-app-side-panel__tab"
                  aria-selected={selected}
                  role="tab"
                  onClick={() => setActiveTable(table.table_key)}
                >
                  {table.table_key}
                  <Span className="generated-app-side-panel__tab-count">{table.row_count}</Span>
                </Button>
              );
            })}
          </Div>
          {isLoadingRows ? (
            <Div className="generated-app-side-panel__empty">{t('moa_apps_ai.data_console.loading')}</Div>
          ) : rows.length === 0 ? (
            <Div className="generated-app-side-panel__empty">{t('moa_apps_ai.data_console.empty_rows')}</Div>
          ) : (
            <Div className="generated-app-side-panel__list" role="list">
              {rows.map((row) => (
                <Div key={row.id} className="generated-app-side-panel__row" role="listitem">
                  <Div className="generated-app-side-panel__row-main">
                    <Span className="generated-app-side-panel__row-title">#{row.id}</Span>
                    <Span className="generated-app-side-panel__row-sub generated-app-side-panel__payload">
                      {summarizePayload(row.payload)}
                    </Span>
                  </Div>
                  <Button
                    type="button"
                    variant="danger-outline"
                    size="xs"
                    className="generated-app-side-panel__row-action"
                    disabled={busy}
                    onClick={() => void handleDelete(row.id)}
                  >
                    {deletingId === row.id
                      ? t('moa_apps_ai.data_console.deleting')
                      : t('moa_apps_ai.data_console.delete_row')}
                  </Button>
                </Div>
              ))}
            </Div>
          )}
        </>
      )}
    </GeneratedAppSidePanelShell>
  );
}
