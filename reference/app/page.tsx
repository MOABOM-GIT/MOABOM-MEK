"use client";

import LiquidBackground from "@/shared/components/LiquidBackground";
import LiquidGlassButton from "@/shared/components/LiquidGlassButton";
import LiquidGlassPanel from "@/shared/components/LiquidGlassPanel";
import ModelShowcase from "@/shared/components/ModelShowcase";
import "@/shared/styles/liquid-glass.css";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-16 md:px-10">
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: "url('/app-assets/images/bg.jpg')",
          opacity: 0.72
        }} 
      />
      <div className="fixed inset-0 z-[1] bg-slate-950/48" />

      <LiquidBackground />

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-12">
        {/* Quick Links */}
        <div className="flex gap-3 justify-center">
          <a href="/3d-scan" className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded border border-white/20 text-white text-sm transition">
            3D Scan
          </a>
          <a href="/ai-generator" className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded border border-white/20 text-white text-sm transition">
            AI Generator
          </a>
          <a href="/cpap-mask" className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded border border-white/20 text-white text-sm transition">
            CPAP Mask
          </a>
        </div>

        <header className="space-y-5 text-center">
          <p className="text-xs uppercase tracking-[0.5em] text-cyan-300/80">Liquid Glass UI System</p>
          <h1 className="text-balance text-4xl font-black tracking-tight text-white drop-shadow-2xl md:text-6xl">
            미래적인 유리 질감 버튼과 패널
          </h1>
          <p className="mx-auto max-w-3xl text-balance text-sm leading-7 text-zinc-300 md:text-base">
            버튼과 패널은 DOM 컴포넌트로 유지하고, 네온 스캔 라인과 입체적인 글래스 질감을
            CSS 커스텀 속성으로 제어할 수 있게 구성했습니다. 색상과 크기만 바꿔서 바로
            라이브러리화할 수 있습니다.
          </p>
        </header>

        <div className="soft-glass-stage">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Reference Mood Prototype</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-700">첨부하신 느낌의 Soft Glass</h2>
          </div>
          <div className="soft-glass-grid">
            <button className="soft-glass-control soft-glass-control--cta">
              <span>Create workspace</span>
            </button>
            <button className="soft-glass-control soft-glass-control--icon soft-glass-control--sun">
              <span>~</span>
            </button>
            <button className="soft-glass-control soft-glass-control--icon soft-glass-control--blue">
              <span>↓</span>
            </button>
            <div className="soft-glass-control soft-glass-control--search">
              <span>⌕</span>
              <span>Search projects...</span>
            </div>
            <div className="soft-glass-control soft-glass-control--check">
              <span>○</span>
            </div>
            <div className="soft-glass-control soft-glass-control--tab">
              <span>+ | + | v | +</span>
            </div>
            <div className="soft-glass-control soft-glass-control--switch">
              <span>Switch</span>
              <span className="soft-glass-knob" />
            </div>
            <div className="soft-glass-control soft-glass-control--tab">
              <span>Tabs</span>
              <span>v</span>
            </div>
            <button className="soft-glass-control soft-glass-control--upgrade">
              <span>Upgrade plan</span>
            </button>
          </div>
        </div>

        <ModelShowcase />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <LiquidGlassPanel
            title="Action Buttons"
            description="사이즈와 네온 색상만 바꾸면 여러 페이지에서 동일한 룩앤필을 유지합니다."
            tone="cyan"
          >
            <LiquidGlassButton size="sm" tone="cyan">Launch</LiquidGlassButton>
            <LiquidGlassButton size="md" tone="violet">Analyze</LiquidGlassButton>
            <LiquidGlassButton size="lg" tone="emerald">Deploy</LiquidGlassButton>
          </LiquidGlassPanel>

          <LiquidGlassPanel
            title="Tone Variants"
            description="동일 컴포넌트에 tone만 다르게 주어 브랜드별 테마를 빠르게 적용합니다."
            tone="violet"
          >
            <LiquidGlassButton tone="cyan">Cyber Cyan</LiquidGlassButton>
            <LiquidGlassButton tone="violet">Royal Violet</LiquidGlassButton>
            <LiquidGlassButton tone="amber">Signal Amber</LiquidGlassButton>
          </LiquidGlassPanel>

          <LiquidGlassPanel
            title="Panel + CTA"
            description="대시보드의 카드와 CTA를 같은 유리 재질 계열로 통일할 때 사용합니다."
            tone="emerald"
          >
            <LiquidGlassButton size="lg" tone="emerald" glowStrength={1.25}>
              Open Dashboard
            </LiquidGlassButton>
          </LiquidGlassPanel>
        </div>

        <div className="rounded-3xl border border-white/15 bg-black/20 p-6 backdrop-blur-md">
          <p className="text-xs uppercase tracking-[0.36em] text-zinc-400">Design Note</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">언제 Canvas를 써야 하나?</h2>
          <div className="mt-5 grid gap-3 text-sm text-zinc-200/90 md:grid-cols-2">
            <p>1) 버튼/패널 다수: DOM + CSS가 성능/접근성/반응형에서 가장 안전합니다.</p>
            <p>2) 배경 왜곡/실시간 굴절: 현재처럼 선택적으로 canvas(WebGL)를 사용합니다.</p>
            <p>3) 실사급 반사/굴절이 꼭 필요할 때만 고급 shader 버튼을 별도 프리셋으로 둡니다.</p>
            <p>4) 즉, 기본 컴포넌트는 DOM 라이브러리, 프리미엄 모드만 WebGL로 분리하는 방식이 좋습니다.</p>
          </div>
        </div>
      </section>
    </main>
  );
}