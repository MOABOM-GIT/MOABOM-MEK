/**
 * yet-another-react-lightbox — 별도 IIFE(`image-gallery-lightbox.iife.js`)에만 포함되는 본체.
 */

import React, { useEffect, useRef, useState } from 'react';
import Lightbox, { Slide } from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import Slideshow from 'yet-another-react-lightbox/plugins/slideshow';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';

import { DownloadButton } from './ImageGalleryDownload';
import type { ImageGalleryProps } from './imageGalleryTypes';

/** 스타일은 `imageGalleryLightboxStyles.ts` → 메인 `components.css`에 포함 */

export const ImageGalleryLightboxInner: React.FC<ImageGalleryProps> = ({
  images,
  isOpen,
  onClose,
  startIndex = 0,
  enableZoom = true,
  enableSlideshow = false,
  enableFullscreen = true,
  showCounter = true,
  showDownload = true,
  showThumbnails = true,
  onDownload,
}) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const currentIndexRef = useRef(startIndex);

  const slides: Slide[] = images.map((image) => ({
    src: image.src,
    title: image.title,
    description: image.description,
  }));

  const plugins = [];
  if (enableZoom) {
    plugins.push(Zoom);
  }
  if (enableSlideshow) {
    plugins.push(Slideshow);
  }
  if (enableFullscreen) {
    plugins.push(Fullscreen);
  }
  if (showCounter) {
    plugins.push(Counter);
  }
  if (showThumbnails) {
    plugins.push(Thumbnails);
  }

  const currentImage = images[currentIndex];

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  return (
    <Lightbox
      open={isOpen}
      close={onClose}
      slides={slides}
      index={currentIndex}
      plugins={plugins}
      on={{
        view: ({ index }) => {
          if (index !== currentIndexRef.current) {
            setCurrentIndex(index);
          }
        },
      }}
      zoom={{
        maxZoomPixelRatio: 3,
        zoomInMultiplier: 2,
        doubleTapDelay: 300,
        doubleClickDelay: 300,
        doubleClickMaxStops: 2,
        keyboardMoveDistance: 50,
        wheelZoomDistanceFactor: 100,
        pinchZoomDistanceFactor: 100,
        scrollToZoom: true,
      }}
      carousel={{
        finite: true,
        preload: 2,
        padding: '16px',
        spacing: '30%',
      }}
      animation={{
        fade: 250,
        swipe: 500,
        easing: {
          fade: 'ease',
          swipe: 'ease-out',
          navigation: 'ease-in-out',
        },
      }}
      controller={{
        closeOnBackdropClick: true,
        closeOnPullDown: true,
        closeOnPullUp: true,
      }}
      thumbnails={{
        position: 'bottom',
        width: 120,
        height: 80,
        border: 2,
        borderRadius: 4,
        padding: 4,
        gap: 16,
        showToggle: false,
        vignette: true,
      }}
      toolbar={{
        buttons: [
          showDownload && currentImage && (
            <DownloadButton
              key="download"
              image={currentImage}
              index={currentIndex}
              onDownload={onDownload}
            />
          ),
          'close',
        ].filter(Boolean),
      }}
      styles={{
        container: {
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
        },
      }}
    />
  );
};

ImageGalleryLightboxInner.displayName = 'ImageGalleryLightboxInner';
