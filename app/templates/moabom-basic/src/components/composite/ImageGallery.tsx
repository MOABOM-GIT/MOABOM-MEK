/**
 * ImageGallery 컴포넌트
 *
 * 라이트박스(yet-another-react-lightbox)는 IIFE 단일 번들에서 코드 분할이 불가하므로,
 * **갤러리가 열릴 때만** `image-gallery-lightbox.iife.js`를 스크립트 주입으로 로드합니다.
 * (셸 앱 `loadMoabomShellAppComponent`와 동일 패턴)
 *
 * @module composite/ImageGallery
 */

import React, { useCallback, useEffect, useState } from 'react';
import type { ComponentType } from 'react';

import { ensureImageGalleryLightboxLoaded } from '../../runtime/moabomImageGalleryLightboxChunk';
import type { GalleryImage, ImageGalleryProps } from './imageGalleryTypes';

export type { GalleryImage, ImageGalleryProps } from './imageGalleryTypes';
export { executeImageDownload } from './ImageGalleryDownload';

type LightboxComponent = ComponentType<ImageGalleryProps>;

export const ImageGallery: React.FC<ImageGalleryProps> = (props) => {
  const { isOpen } = props;
  const [Inner, setInner] = useState<LightboxComponent | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    let cancelled = false;
    void ensureImageGalleryLightboxLoaded().then((Comp) => {
      if (!cancelled) {
        setInner(() => Comp);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  if (!Inner) {
    return null;
  }

  return <Inner {...props} />;
};

export const useImageGallery = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [startIndex, setStartIndex] = useState(0);

  const openGallery = useCallback((galleryImages: GalleryImage[], index = 0) => {
    setImages(galleryImages);
    setStartIndex(index);
    setIsOpen(true);
  }, []);

  const closeGallery = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    openGallery,
    closeGallery,
    galleryProps: {
      images,
      isOpen,
      onClose: closeGallery,
      startIndex,
    },
  };
};

ImageGallery.displayName = 'ImageGallery';

export default ImageGallery;
