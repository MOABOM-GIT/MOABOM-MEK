import React from 'react';

/** react-glass-ui GlassCard 와 동일한 굴절 노멀 맵 (feDisplacementMap 용) */
const LIQUID_GLASS_DISTORTION_MAP =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAAAK3RFWHRDcmVhdGlvbiBUaW1lAE1vbiAxIEp1biAyMDA5IDAwOjUwOjA4ICswMTAwlMZeaQAAAAd0SU1FB9kGAQsgET14njMAAAAJcEhZcwAACxEAAAsRAX9kX5EAAAAEZ0FNQQAAsY8L/GEFAAACvUlEQVR42u3TgQkAMAzDsBb2/81ld1gi5APvzKxZde8fVAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkHGmUF/FFYhBoAAAAASUVORK5CYII=';

/**
 * 홈 셸에 1회만 마운트 — `.liquid-glass` 가 참조하는 SVG 굴절 필터.
 */
export const Moa_LiquidGlassFilters: React.FC = () => (
  <svg
    aria-hidden
    className="moa-liquid-glass-svg-defs pointer-events-none absolute h-0 w-0 overflow-hidden"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <filter
        id="moa-liquid-glass-distort"
        x="0"
        y="0"
        width="100%"
        height="100%"
        colorInterpolationFilters="sRGB"
      >
        <feImage
          href={LIQUID_GLASS_DISTORTION_MAP}
          result="originalMap"
          preserveAspectRatio="xMidYMid slice"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="originalMap"
          scale="35"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </defs>
  </svg>
);
