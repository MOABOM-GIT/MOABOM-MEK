"use client";

import type { CSSProperties, ButtonHTMLAttributes, ReactNode } from "react";

type LiquidGlassButtonSize = "sm" | "md" | "lg";
type LiquidGlassButtonTone = "cyan" | "violet" | "emerald" | "amber";

const TONE_MAP: Record<LiquidGlassButtonTone, string> = {
  cyan: "#00e5ff",
  violet: "#8b5cf6",
  emerald: "#10b981",
  amber: "#f59e0b",
};

interface LiquidGlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: LiquidGlassButtonSize;
  tone?: LiquidGlassButtonTone;
  glowStrength?: number;
  children: ReactNode;
}

export default function LiquidGlassButton({
  size = "md",
  tone = "cyan",
  glowStrength = 1,
  className,
  children,
  style,
  ...rest
}: LiquidGlassButtonProps) {
  const mergedStyle: CSSProperties = {
    "--lg-neon-color": TONE_MAP[tone],
    "--lg-glow-strength": glowStrength.toString(),
    ...style,
  } as CSSProperties;

  return (
    <button
      {...rest}
      style={mergedStyle}
      className={`liquid-glass-btn liquid-glass-btn--${size}${className ? ` ${className}` : ""}`}
    >
      <span className="liquid-glass-btn__surface" />
      <span className="liquid-glass-btn__scanline" />
      <span className="liquid-glass-btn__label">{children}</span>
    </button>
  );
}
