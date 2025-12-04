import React, { useState, useEffect, memo, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { GlassCard } from './GlassCard';
import {
  HUDHeader,
  Spotlight,
  PrivacySchematic,
  LatencyCounter,
  MiniDiffViewer,
  SmartPivotAnimation,
  UseCaseSection,
  CreatorStatement,
  EnhancedFooter,
  LegalModal,
  CTAButton,
  GlobalKeyListener,
  ANIMATION_EASING,
  TEXT_PRIMARY,
  type LegalModalType,
} from './LandingComponents';

// ============================================================================
// DEMO DATA - Showcasing Smart Pivot Translation
// ============================================================================
const DEMO_ORIGINAL = "hey, just checking in about the project. its been a while and i wanted to see if everything is going ok. let me know when u get a chance.";
const DEMO_TRANSLATED = "Good afternoon. I wanted to follow up regarding the current project status. Could you kindly provide an update at your earliest convenience?";

// ============================================================================
// ANIMATED DIFF DISPLAY - Non-interactive showcase
// ============================================================================
const DemoTransformation = memo(() => {
  const [phase, setPhase] = useState<'original' | 'transitioning' | 'translated'>('original');
  
  useEffect(() => {
    const timer1 = setTimeout(() => setPhase('transitioning'), 2000);
    const timer2 = setTimeout(() => setPhase('translated'), 2800);
    const timer3 = setTimeout(() => setPhase('original'), 6000);
    
    const interval = setInterval(() => {
      setPhase('original');
      setTimeout(() => setPhase('transitioning'), 2000);
      setTimeout(() => setPhase('translated'), 2800);
    }, 6000);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="relative">
      {/* Label */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`
          px-3 py-1.5 rounded-full
          text-[10px] tracking-[0.2em] uppercase font-medium
          transition-all duration-700
          ${phase === 'original' 
            ? 'bg-white/[0.04] text-neutral-500 border border-white/[0.06]' 
            : 'bg-white/[0.08] text-white border border-white/[0.12]'
          }
        `}>
          {phase === 'original' ? 'Input' : 'Refined Output'}
        </div>
        {phase !== 'original' && (
          <div className="flex items-center gap-2 text-[10px] tracking-[0.15em] text-neutral-600 animate-[fadeSlideIn_400ms_cubic-bezier(0.16,1,0.3,1)_forwards]">
            <Sparkles size={12} className="text-neutral-500" />
            <span>EXECUTIVE TONE APPLIED</span>
          </div>
        )}
      </div>
      
      {/* Text Display */}
      <div className="relative min-h-[120px]">
        <p className={`
          text-lg sm:text-xl font-light leading-relaxed tracking-tight
          transition-all duration-700
          ${phase === 'original' ? 'opacity-100 blur-0' : 'opacity-0 blur-[2px] absolute inset-0'}
          text-neutral-400
        `}>
          {DEMO_ORIGINAL}
        </p>
        
        <p className={`
          text-lg sm:text-xl font-light leading-relaxed tracking-tight
          transition-all duration-700
          ${phase === 'translated' ? 'opacity-100 blur-0' : 'opacity-0 blur-[2px] absolute inset-0'}
          text-[#ededed]
        `}>
          {DEMO_TRANSLATED}
        </p>
        
        {phase === 'transitioning' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-3 text-neutral-500">
              <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse" />
              <span className="text-[10px] tracking-[0.3em] uppercase">Processing</span>
              <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse" style={{ animationDelay: '150ms' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

DemoTransformation.displayName = 'DemoTransformation';

// ============================================================================
// BENTO CARD - Rich Visualization Container
// ============================================================================
interface BentoCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

const BentoCard = memo<BentoCardProps>(({ 
  title, 
  subtitle, 
  children, 
  className = '',
  delay = 0 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div 
      ref={ref}
      className={`
        transition-all duration-700
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
        ${className}
      `}
    >
      <GlassCard hoverEffect className="h-full overflow-hidden">
        {/* Visualization Area */}
        <div className="p-6 pb-2">
          {children}
        </div>
        
        {/* Text Content */}
        <div className="p-6 pt-4 border-t border-white/[0.04]">
          <h3 className="text-base font-medium text-[#ededed] tracking-tight mb-1">
            {title}
          </h3>
          <p className="text-sm text-neutral-500 leading-relaxed">
            {subtitle}
          </p>
        </div>
      </GlassCard>
    </div>
  );
});

BentoCard.displayName = 'BentoCard';

// ============================================================================
// MAIN LANDING PAGE COMPONENT
// ============================================================================
interface LandingPageProps {
  onEnter: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  const [heroVisible, setHeroVisible] = useState(false);
  const [activeModal, setActiveModal] = useState<LegalModalType>(null);
  const heroRef = useRef<HTMLElement>(null);
  
  useEffect(() => {
    const timer = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="
      min-h-screen 
      flex flex-col 
      selection:bg-white/20 selection:text-white
      overflow-x-hidden
    ">
      {/* Floating HUD Header */}
      <HUDHeader onLaunch={onEnter} />

      {/* ================================================================
          HERO SECTION - Cinematic & Commanding
          ================================================================ */}
      <section 
        ref={heroRef}
        className="
          relative
          min-h-screen
          flex flex-col items-center justify-center
          px-6 py-20 pt-32
        "
      >
        {/* Spotlight Effect */}
        <Spotlight containerRef={heroRef as React.RefObject<HTMLElement>} />
        
        {/* Ambient Light - Subtle radial gradient */}
        <div className="
          absolute inset-0 
          bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.03),transparent)]
          pointer-events-none
        " />
        
        {/* Hero Content */}
        <div className={`
          relative z-10
          max-w-4xl mx-auto
          text-center
          transition-all duration-1000
          ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
        `}>
          {/* Wordmark */}
          <div className="mb-8">
            <span className="
              text-[10px] tracking-[0.4em] uppercase
              text-neutral-600 font-medium
            ">
              Introducing
            </span>
          </div>
          
          {/* Main Headline */}
          <h1 className="
            text-5xl sm:text-6xl md:text-7xl
            font-light
            tracking-[-0.02em]
            text-[#ededed]
            mb-8
            leading-[1]
          ">
            Translation for the
            <br />
            <span className="font-normal text-white">Executive Mind</span>
          </h1>
          
          {/* Subheadline */}
          <p className="
            text-lg sm:text-xl
            text-neutral-500
            font-light
            leading-relaxed
            max-w-2xl mx-auto
            mb-12
            tracking-tight
          ">
            Neural translation with intelligent tone refinement. 
            Your API key, your data, your control.
            <br />
            <span className="text-neutral-600">Nothing leaves your browser.</span>
          </p>
          
          {/* CTA */}
          <div className={`
            transition-all duration-700
            ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
          `} style={{ transitionDelay: '200ms' }}>
            <CTAButton onClick={onEnter}>
              Launch Verbum
            </CTAButton>
          </div>
          
          {/* Keyboard Hint */}
          <div className={`
            mt-8
            flex items-center justify-center gap-2
            text-[10px] tracking-[0.2em] text-neutral-700
            transition-all duration-700
            ${heroVisible ? 'opacity-100' : 'opacity-0'}
          `} style={{ transitionDelay: '400ms' }}>
            <kbd className="
              px-2 py-1 rounded
              bg-white/[0.03] border border-white/[0.06]
              font-mono text-neutral-500
            ">
              Enter
            </kbd>
            <span>to proceed</span>
          </div>
        </div>
        
        {/* Hero Demo - Floating Glass Card */}
        <div className={`
          relative z-10
          w-full max-w-2xl mx-auto
          mt-16
          transition-all duration-1000
          ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}
        `} style={{ transitionDelay: '300ms' }}>
          <GlassCard isActive className="p-8">
            <DemoTransformation />
          </GlassCard>
        </div>
        
        {/* Scroll Indicator */}
        <div className="
          absolute bottom-12 left-1/2 -translate-x-1/2
          flex flex-col items-center gap-3
          text-neutral-700
        ">
          <span className="text-[10px] tracking-[0.3em] uppercase">Scroll</span>
          <div className="
            w-px h-8
            bg-gradient-to-b from-neutral-700 to-transparent
            animate-pulse
          " />
        </div>
      </section>

      {/* ================================================================
          FEATURE GRID - Bento V2 with Rich Visualizations
          ================================================================ */}
      <section 
        id="capabilities"
        className="
          relative
          px-6 py-32
          max-w-6xl mx-auto w-full
        "
      >
        {/* Section Header */}
        <div className="text-center mb-20">
          <span className="
            text-[10px] tracking-[0.4em] uppercase
            text-neutral-600 font-medium
            block mb-4
          ">
            Architecture
          </span>
          <h2 className="
            text-3xl sm:text-4xl
            font-light
            tracking-[-0.02em]
            text-[#ededed]
          ">
            Engineered for Precision
          </h2>
        </div>
        
        {/* Bento Grid V2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card A: Privacy Architecture - Large */}
          <BentoCard
            title="Local-First Architecture"
            subtitle="Your API Key never leaves localhost. Zero server transmission."
            className="md:col-span-2"
            delay={0}
          >
            <PrivacySchematic />
          </BentoCard>
          
          {/* Card B: Latency/Speed */}
          <BentoCard
            title="Sub-Second Inference"
            subtitle="Optimized for Gemini Flash models."
            delay={100}
          >
            <LatencyCounter />
          </BentoCard>
          
          {/* Card C: Smart Pivot */}
          <BentoCard
            title="Smart Pivot"
            subtitle="Auto-detects input language."
            delay={200}
          >
            <SmartPivotAnimation />
          </BentoCard>
          
          {/* Card D: Diff Engine - Wide */}
          <BentoCard
            title="Visual Diff Engine"
            subtitle="Character-level transformation tracking."
            className="md:col-span-2"
            delay={300}
          >
            <MiniDiffViewer />
          </BentoCard>
          
          {/* Card E: Neural Refinement */}
          <BentoCard
            title="Tone Control"
            subtitle="Executive, Concise, Diplomatic modes."
            delay={400}
          >
            <div className="h-32 flex flex-col items-center justify-center">
              <div className="flex flex-wrap gap-2 justify-center">
                {['Executive', 'Concise', 'Diplomatic'].map((tone, i) => (
                  <span 
                    key={tone}
                    className={`
                      px-3 py-1.5 rounded-full
                      text-[10px] tracking-[0.1em] uppercase
                      border transition-all duration-500
                      ${i === 0 
                        ? 'bg-white/[0.06] border-white/[0.12] text-white' 
                        : 'bg-white/[0.02] border-white/[0.04] text-neutral-500'
                      }
                    `}
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    {tone}
                  </span>
                ))}
              </div>
              <span className="mt-4 text-[9px] tracking-[0.15em] uppercase text-neutral-600">
                + Custom Instructions
              </span>
            </div>
          </BentoCard>
          
          {/* Card F: Context Memory */}
          <BentoCard
            title="Context Memory"
            subtitle="Session history for consistent output."
            delay={500}
          >
            <div className="h-32 flex flex-col items-center justify-center">
              <div className="flex items-end gap-1 h-16">
                {[0.3, 0.5, 0.7, 0.85, 1].map((height, i) => (
                  <div
                    key={i}
                    className="w-3 bg-gradient-to-t from-white/20 to-white/5 rounded-t"
                    style={{ 
                      height: `${height * 100}%`,
                      opacity: 0.4 + (i * 0.15)
                    }}
                  />
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-[9px] tracking-[0.1em] text-neutral-600 font-mono">
                  depth: 64
                </span>
              </div>
            </div>
          </BentoCard>
        </div>
      </section>

      {/* ================================================================
          USE CASES SECTION
          ================================================================ */}
      <UseCaseSection />

      {/* ================================================================
          CREATOR STATEMENT
          ================================================================ */}
      <CreatorStatement />

      {/* ================================================================
          ENHANCED FOOTER
          ================================================================ */}
      <EnhancedFooter onOpenModal={setActiveModal} />
      
      {/* Legal Modal */}
      <LegalModal type={activeModal} onClose={() => setActiveModal(null)} />
      
      {/* Global Keyboard Listener */}
      <GlobalKeyListener onEnter={onEnter} />
    </div>
  );
};

export default LandingPage;
