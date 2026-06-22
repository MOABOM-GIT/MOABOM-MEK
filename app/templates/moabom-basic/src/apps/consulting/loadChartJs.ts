/** AI 앱 생성(dataviz)과 동일한 Chart.js 4.5.1 UMD CDN — 시뮬레이션 탭 진입 시에만 로드 */

export const CHART_JS_CDN_SRC =
  'https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js';

export const CHART_JS_SCRIPT_ID = 'moabom-chartjs-cdn';

type ChartInstance = {
  destroy: () => void;
};

export type ChartConstructor = new (
  ctx: CanvasRenderingContext2D | HTMLCanvasElement,
  config: Record<string, unknown>,
) => ChartInstance;

declare global {
  interface Window {
    Chart?: ChartConstructor;
  }
}

let loadPromise: Promise<ChartConstructor> | null = null;

export function ensureChartJsLoaded(): Promise<ChartConstructor> {
  if (typeof window !== 'undefined' && window.Chart) {
    return Promise.resolve(window.Chart);
  }

  const pending = loadPromise;
  if (pending) {
    return pending;
  }

  loadPromise = new Promise<ChartConstructor>((resolve, reject) => {
    if (typeof document === 'undefined') {
      loadPromise = null;
      reject(new Error('ensureChartJsLoaded requires a browser environment'));
      return;
    }

    const existing = document.getElementById(CHART_JS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      const onReady = () => {
        if (window.Chart) {
          resolve(window.Chart);
        } else {
          loadPromise = null;
          reject(new Error('Chart.js script present but window.Chart is undefined'));
        }
      };
      if (window.Chart) {
        onReady();
        return;
      }
      existing.addEventListener('load', onReady, { once: true });
      existing.addEventListener(
        'error',
        () => {
          loadPromise = null;
          reject(new Error(`Failed to load Chart.js: ${CHART_JS_CDN_SRC}`));
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.id = CHART_JS_SCRIPT_ID;
    script.src = CHART_JS_CDN_SRC;
    script.async = true;
    script.onload = () => {
      if (window.Chart) {
        resolve(window.Chart);
      } else {
        loadPromise = null;
        reject(new Error('Chart.js loaded but window.Chart is undefined'));
      }
    };
    script.onerror = () => {
      loadPromise = null;
      script.remove();
      reject(new Error(`Failed to load Chart.js: ${CHART_JS_CDN_SRC}`));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
