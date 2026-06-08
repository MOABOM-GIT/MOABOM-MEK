/**
 * 지연 로드용 IIFE 진입 — `window.__MoabomImageGalleryLightboxInner` 등록.
 * (메인 IIFE는 코드 분할 불가 → 셸과 동일한 별도 빌드)
 */

import type { ComponentType } from 'react';

import { ImageGalleryLightboxInner } from './ImageGalleryLightbox';
import type { ImageGalleryProps } from './imageGalleryTypes';

const w = window as Window & { __MoabomImageGalleryLightboxInner?: ComponentType<ImageGalleryProps> };
w.__MoabomImageGalleryLightboxInner = ImageGalleryLightboxInner;

export {};
