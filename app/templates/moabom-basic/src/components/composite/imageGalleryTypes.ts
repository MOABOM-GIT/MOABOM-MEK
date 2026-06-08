/**
 * ImageGallery 공용 타입 (라이트박스 지연 청크와 공유).
 */

export interface GalleryImage {
  src: string;
  downloadUrl?: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  filename?: string;
  downloadRequiresAuth?: boolean;
}

export interface ImageGalleryProps {
  images: GalleryImage[];
  isOpen: boolean;
  onClose: () => void;
  startIndex?: number;
  enableZoom?: boolean;
  enableSlideshow?: boolean;
  enableFullscreen?: boolean;
  showCounter?: boolean;
  showDownload?: boolean;
  showThumbnails?: boolean;
  onDownload?: (image: GalleryImage, index: number) => void;
}
