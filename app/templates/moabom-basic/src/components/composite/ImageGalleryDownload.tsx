/**
 * ImageGallery 다운로드 UI (라이트박스 지연 청크에서 사용).
 */

import React, { useState } from 'react';
import { Button } from '../basic/Button';
import { I } from '../basic/I';
import type { GalleryImage } from './imageGalleryTypes';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const G7Core = (window as any).G7Core;

const t = (key: string, params?: Record<string, string | number>) =>
  G7Core?.t?.(key, params) ?? key;

export const executeImageDownload = async (image: GalleryImage): Promise<void> => {
  const downloadUrl = image.downloadUrl || image.src;
  const filename = image.filename || image.title || 'image';

  if (image.downloadRequiresAuth) {
    try {
      const blob = await G7Core.api.get(downloadUrl, {
        responseType: 'blob',
      });

      if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      }
    } catch (error) {
      console.error('Failed to download file:', error);
      G7Core?.toast?.error?.(t('common.download_failed'));
    }
    return;
  }

  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

interface DownloadButtonProps {
  image: GalleryImage;
  index: number;
  onDownload?: (image: GalleryImage, index: number) => void;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({ image, index, onDownload }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (onDownload) {
      onDownload(image, index);
      return;
    }

    setIsDownloading(true);
    try {
      await executeImageDownload(image);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button
      type="button"
      onClick={handleDownload}
      disabled={isDownloading}
      className="yarl__button flex items-center justify-center"
      aria-label={t('common.download')}
      title={t('common.download')}
    >
      {isDownloading ? (
        <I className="fa-solid fa-spinner fa-spin text-white" />
      ) : (
        <I className="fa-solid fa-download text-white" />
      )}
    </Button>
  );
};
