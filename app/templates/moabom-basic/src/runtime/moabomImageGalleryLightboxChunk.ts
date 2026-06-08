/**
 * ImageGallery 라이트박스 전용 IIFE 스크립트 지연 로드.
 * @see `src/apps/index.ts` — `loadMoabomShellAppComponent`와 동일한 URL·쿼리 패턴
 */

import type { ComponentType } from 'react';

import templateMetadata from '../../template.json';
import type { ImageGalleryProps } from '../components/composite/imageGalleryTypes';
import { postMoabomLazyPrecache } from './moabomLazyPrecache';

type LightboxInner = ComponentType<ImageGalleryProps>;

declare global {
  interface Window {
    __MoabomImageGalleryLightboxInner?: LightboxInner;
  }
}

const CHUNK_FILE = 'image-gallery-lightbox.iife.js';

let loadPromise: Promise<LightboxInner> | null = null;

function readComponentsBundleQuery(): string {
  if (typeof document === 'undefined') {
    return '';
  }
  const nodes = document.querySelectorAll('script[src*="components.iife"]');
  for (let i = nodes.length - 1; i >= 0; i--) {
    const src = nodes[i].getAttribute('src');
    if (!src) {
      continue;
    }
    const qIdx = src.indexOf('?');
    if (qIdx >= 0) {
      return src.slice(qIdx);
    }
  }
  return '';
}

function chunkUrl(): string {
  const id = (templateMetadata as { identifier?: string }).identifier ?? 'moabom-basic';
  const base = `/api/templates/assets/${id}/js/${CHUNK_FILE}`;
  return `${base}${readComponentsBundleQuery()}`;
}

export function ensureImageGalleryLightboxLoaded(): Promise<LightboxInner> {
  const existing = typeof window !== 'undefined' ? window.__MoabomImageGalleryLightboxInner : undefined;
  if (existing) {
    return Promise.resolve(existing);
  }

  const pending = loadPromise;
  if (pending) {
    return pending;
  }

  loadPromise = new Promise<LightboxInner>((resolve, reject) => {
    if (typeof document === 'undefined') {
      loadPromise = null;
      reject(new Error('ensureImageGalleryLightboxLoaded requires a browser environment'));
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    const url = chunkUrl();
    script.src = url;
    postMoabomLazyPrecache([url], 'image-gallery-lightbox');
    script.onload = () => {
      loadPromise = null;
      const Comp = window.__MoabomImageGalleryLightboxInner;
      if (Comp) {
        resolve(Comp);
      } else {
        reject(new Error('image-gallery-lightbox chunk loaded but inner component was not registered'));
      }
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error(`Failed to load image-gallery-lightbox chunk: ${script.src}`));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
