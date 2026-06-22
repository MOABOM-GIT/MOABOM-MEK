import { useEffect, useMemo, useRef, useState } from 'react';
import { Div } from '../../components/basic/Div';
import { CONSULTING_COLORS } from './consultingTheme';
import { ensureChartJsLoaded, type ChartConstructor } from './loadChartJs';
import { formatKrwManwon, type ScenarioResult } from './simulationModel';

interface EbitChartPanelsProps {
  self: ScenarioResult;
  smart: ScenarioResult;
}

function yearLabels(years: number): string[] {
  return Array.from({ length: years }, (_, i) => `Y${i + 1}`);
}

function readChartTheme() {
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  return {
    tick: dark ? 'rgb(148 163 184)' : 'rgb(100 116 139)',
    grid: dark ? 'rgb(255 255 255 / 10%)' : 'rgb(15 45 58 / 10%)',
  };
}

function buildSharedScaleOptions(theme: ReturnType<typeof readChartTheme>) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) =>
            `${ctx.dataset.label ?? ''}: ${formatKrwManwon(ctx.parsed.y)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: theme.tick, font: { weight: 'bold' as const, size: 11 } },
      },
      y: {
        grid: { color: theme.grid },
        ticks: {
          color: theme.tick,
          font: { size: 10 },
          callback: (value: string | number) => formatKrwManwon(Number(value)),
        },
      },
    },
  };
}

export function EbitChartPanels({ self, smart }: EbitChartPanelsProps) {
  const barRef = useRef<HTMLCanvasElement>(null);
  const lineRef = useRef<HTMLCanvasElement>(null);
  const barChartRef = useRef<{ destroy: () => void } | null>(null);
  const lineChartRef = useRef<{ destroy: () => void } | null>(null);
  const chartCtorRef = useRef<ChartConstructor | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const labels = useMemo(() => yearLabels(self.yearly.length), [self.yearly.length]);
  const selfValues = useMemo(() => self.yearly.map(y => y.ebit), [self.yearly]);
  const smartValues = useMemo(() => smart.yearly.map(y => y.ebit), [smart.yearly]);

  useEffect(() => {
    let cancelled = false;

    void ensureChartJsLoaded()
      .then(Chart => {
        if (cancelled) return;
        chartCtorRef.current = Chart;
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
      barChartRef.current?.destroy();
      lineChartRef.current?.destroy();
      barChartRef.current = null;
      lineChartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;

    const Chart = chartCtorRef.current;
    const barCanvas = barRef.current;
    const lineCanvas = lineRef.current;
    if (!Chart || !barCanvas || !lineCanvas) return;

    const theme = readChartTheme();
    const shared = buildSharedScaleOptions(theme);

    barChartRef.current?.destroy();
    barChartRef.current = new Chart(barCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: '직접 운영',
            data: selfValues,
            backgroundColor: CONSULTING_COLORS.orange,
            borderRadius: 4,
          },
          {
            label: '스마트케어360',
            data: smartValues,
            backgroundColor: CONSULTING_COLORS.mint,
            borderRadius: 4,
          },
        ],
      },
      options: shared,
    });

    lineChartRef.current?.destroy();
    lineChartRef.current = new Chart(lineCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '직접 운영',
            data: selfValues,
            borderColor: CONSULTING_COLORS.orange,
            backgroundColor: CONSULTING_COLORS.orange,
            pointBackgroundColor: CONSULTING_COLORS.orange,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            tension: 0.25,
          },
          {
            label: '스마트케어360',
            data: smartValues,
            borderColor: CONSULTING_COLORS.mint,
            backgroundColor: CONSULTING_COLORS.mint,
            pointBackgroundColor: CONSULTING_COLORS.mint,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            tension: 0.25,
          },
        ],
      },
      options: shared,
    });
  }, [status, labels, selfValues, smartValues]);

  if (status === 'error') {
    return (
      <Div className="moa-consult-chart-status moa-consult-chart-status--error" role="alert">
        차트를 불러오지 못했습니다. {errorMessage}
      </Div>
    );
  }

  return (
    <Div className="moa-consult-chart-split">
      <Div className="moa-consult-chart-panel">
        <Div className="moa-consult-chart-panel__title">연도별 EBIT 트렌드</Div>
        <Div className="moa-consult-chart-canvas-wrap" aria-busy={status === 'loading'}>
          <canvas ref={barRef} aria-label="직접 운영과 스마트케어360 연도별 EBIT 막대 차트" />
          {status === 'loading' && (
            <Div className="moa-consult-chart-status">차트 로딩 중…</Div>
          )}
        </Div>
      </Div>
      <Div className="moa-consult-chart-panel">
        <Div className="moa-consult-chart-panel__title">운영 방식 비교 (라인)</Div>
        <Div className="moa-consult-chart-canvas-wrap" aria-busy={status === 'loading'}>
          <canvas ref={lineRef} aria-label="직접 운영과 스마트케어360 EBIT 연도별 라인 차트" />
          {status === 'loading' && (
            <Div className="moa-consult-chart-status">차트 로딩 중…</Div>
          )}
        </Div>
      </Div>
    </Div>
  );
}
