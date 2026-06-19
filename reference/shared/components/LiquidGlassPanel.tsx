"use client";

import type { CSSProperties, ReactNode } from "react";

type LiquidGlassPanelTone = "cyan" | "violet" | "emerald";

const PANEL_TONE: Record<LiquidGlassPanelTone, string> = {
  cyan: "#22d3ee",
  violet: "#a78bfa",
  emerald: "#34d399",
};

interface LiquidGlassPanelProps {
  title: string;
  description: string;
  tone?: LiquidGlassPanelTone;
  children?: ReactNode;
}

export default function LiquidGlassPanel({
  title,
  description,
  tone = "cyan",
  children,
}: LiquidGlassPanelProps) {
  const style = {
    "--lg-panel-neon": PANEL_TONE[tone],
  } as CSSProperties;

  return (
    <article className="liquid-glass-panel" style={style}>
      <h3 className="liquid-glass-panel__title">{title}</h3>
      <p className="liquid-glass-panel__description">{description}</p>
      {children ? <div className="liquid-glass-panel__actions">{children}</div> : null}
    </article>
  );
}
