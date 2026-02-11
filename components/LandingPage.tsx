import React, { useState, useEffect, memo, useRef, useCallback } from 'react';
import { Sparkles, Languages, Wand2, Globe2 } from 'lucide-react';
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
// OMNI-SHOWCASE SCENARIOS - Demonstrating Verbum's Full Capabilities
// Each scenario showcases a different use case with diverse language pairs
// ============================================================================

type ScenarioMode = 'translation' | 'refinement' | 'pivot';

interface Scenario {
  id: string;
  mode: ScenarioMode;
  label: string;
  badge: string;
  icon: React.ElementType;
  input: string;
  output: string;
}

const SCENARIOS: Scenario[] = [
  // === SMART TRANSLATION ===
  {
    id: 'pt-en-business',
    mode: 'translation',
    label: 'SMART TRANSLATION',
    badge: 'PT → EN',
    icon: Languages,
    input: 'o prazo tá curto e a gente precisa alinhar isso logo.',
    output: 'Given the tight deadline, we must align on this matter immediately.',
  },
  {
    id: 'ja-en-formal',
    mode: 'translation',
    label: 'SMART TRANSLATION',
    badge: 'JA → EN',
    icon: Languages,
    input: '来週の会議について、ご都合をお聞かせください。',
    output: 'Please let me know your availability for next week\'s meeting.',
  },
  {
    id: 'de-en-tech',
    mode: 'translation',
    label: 'SMART TRANSLATION',
    badge: 'DE → EN',
    icon: Languages,
    input: 'Die Systemarchitektur muss vor dem nächsten Sprint überarbeitet werden.',
    output: 'The system architecture must be revised before the next sprint.',
  },
  
  // === TONE REFINEMENT ===
  {
    id: 'en-en-executive',
    mode: 'refinement',
    label: 'TONE REFINEMENT',
    badge: 'EXECUTIVE',
    icon: Wand2,
    input: 'i think the budget is wrong, pls fix it.',
    output: 'There appears to be a discrepancy in the budget; kindly rectify it.',
  },
  {
    id: 'en-en-diplomatic',
    mode: 'refinement',
    label: 'TONE REFINEMENT',
    badge: 'DIPLOMATIC',
    icon: Wand2,
    input: 'your proposal doesnt work and we need something better.',
    output: 'While we appreciate your proposal, we believe there may be room for alternative approaches that better align with our objectives.',
  },
  {
    id: 'en-en-concise',
    mode: 'refinement',
    label: 'TONE REFINEMENT',
    badge: 'CONCISE',
    icon: Wand2,
    input: 'I wanted to reach out to you to let you know that we have decided to move forward with the project and we would like to schedule a meeting.',
    output: 'We\'re proceeding with the project. Let\'s schedule a meeting.',
  },

  // === GLOBAL PIVOT ===
  {
    id: 'es-en-meeting',
    mode: 'pivot',
    label: 'GLOBAL PIVOT',
    badge: 'ES → EN',
    icon: Globe2,
    input: 'Necesitamos programar la reunión para el próximo trimestre.',
    output: 'We need to schedule the meeting for the upcoming quarter.',
  },
  {
    id: 'fr-en-contract',
    mode: 'pivot',
    label: 'GLOBAL PIVOT',
    badge: 'FR → EN',
    icon: Globe2,
    input: 'Veuillez trouver ci-joint le contrat signé pour votre examen.',
    output: 'Please find attached the signed contract for your review.',
  },
  {
    id: 'zh-en-update',
    mode: 'pivot',
    label: 'GLOBAL PIVOT',
    badge: 'ZH → EN',
    icon: Globe2,
    input: '我们需要在下周之前完成项目的最终审核。',
    output: 'We need to complete the final review of the project by next week.',
  },
  {
    id: 'ar-en-proposal',
    mode: 'pivot',
    label: 'GLOBAL PIVOT',
    badge: 'AR → EN',
    icon: Globe2,
    input: 'نرجو منكم مراجعة الاقتراح وإبداء ملاحظاتكم.',
    output: 'We kindly request you to review the proposal and provide your feedback.',
  },
  {
    id: 'ru-en-deadline',
    mode: 'pivot',
    label: 'GLOBAL PIVOT',
    badge: 'RU → EN',
    icon: Globe2,
    input: 'Пожалуйста, подтвердите сроки выполнения проекта.',
    output: 'Please confirm the project delivery timeline.',
  },
  {
    id: 'ko-en-collaboration',
    mode: 'pivot',
    label: 'GLOBAL PIVOT',
    badge: 'KO → EN',
    icon: Globe2,
    input: '다음 주 협력 회의 일정을 조율해 주세요.',
    output: 'Please coordinate the schedule for next week\'s collaboration meeting.',
  },
];

// Timing constants (in ms)
const PHASE_INPUT = 4000;      // Hold input for reading
const PHASE_PROCESSING = 1500; // Processing animation
const PHASE_OUTPUT = 5000;     // Hold output for reading
const CYCLE_DURATION = PHASE_INPUT + PHASE_PROCESSING + PHASE_OUTPUT; // ~10.5s

// ============================================================================
// OMNI-SHOWCASE COMPONENT - The "Verbum Brain" Demo
// Fixed-height container with cinematic cross-fade transitions
// ============================================================================

type Phase = 'input' | 'processing' | 'output';

const OmniShowcase = memo(() => {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('input');
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();
  
  const scenario = SCENARIOS[scenarioIndex];
  const Icon = scenario.icon;

  // Progress bar animation (smooth 60fps)
  useEffect(() => {
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / CYCLE_DURATION) * 100, 100);
      
      if (Math.abs(newProgress - progressRef.current) > 0.5) {
        progressRef.current = newProgress;
        setProgress(newProgress);
      }
      
      if (elapsed < CYCLE_DURATION) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [scenarioIndex]);

  // Phase state machine
  useEffect(() => {
    setPhase('input');
    setProgress(0);
    progressRef.current = 0;
    
    const timer1 = setTimeout(() => setPhase('processing'), PHASE_INPUT);
    const timer2 = setTimeout(() => setPhase('output'), PHASE_INPUT + PHASE_PROCESSING);
    const timer3 = setTimeout(() => {
      // Move to next scenario
      setScenarioIndex(prev => (prev + 1) % SCENARIOS.length);
    }, CYCLE_DURATION);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [scenarioIndex]);

  // Detect RTL for input text
  const isInputRTL = /[\u0600-\u06FF\u0590-\u05FF]/.test(scenario.input);

  return (
    <div className="relative">
      {/* ================================================================
          MODE INDICATOR - Dynamic badge showing current operation
          ================================================================ */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {/* Mode Label */}
          <div className={`
            flex items-center gap-2
            px-3 py-1.5 rounded-full
            text-[10px] tracking-[0.2em] uppercase font-medium
            transition-all duration-700 ease-in-out
            ${phase === 'output' 
              ? 'bg-white/[0.08] text-white border border-white/[0.12]' 
              : 'bg-white/[0.04] text-neutral-500 border border-white/[0.06]'
            }
          `}>
            <Icon size={12} className={`
                transition-all duration-500
                ${phase === 'processing' ? 'animate-pulse' : ''}
                ${phase === 'output' ? 'text-white' : 'text-neutral-500'}
              `} />
            <span>{scenario.label}</span>
          </div>
          
          {/* Language/Mode Badge */}
          <div className={`
            px-2.5 py-1 rounded-md
            text-[9px] tracking-[0.15em] uppercase font-semibold
            transition-all duration-700 ease-in-out
            bg-white/[0.03] border
            border-white/[0.06]
            ${phase === 'output' ? 'text-white' : 'text-neutral-500'}
          `}>
            {scenario.badge}
          </div>
        </div>
        
        {/* Cycle Counter (subtle) */}
        <div className="text-[9px] tracking-[0.15em] text-neutral-700 font-mono tabular-nums">
          {String(scenarioIndex + 1).padStart(2, '0')}/{String(SCENARIOS.length).padStart(2, '0')}
        </div>
      </div>
      
      {/* ================================================================
          TEXT RESERVOIR - Fixed height container with absolute positioning
          Prevents layout shift during transitions
          ================================================================ */}
      <div className="relative min-h-[140px] sm:min-h-[120px]">
        {/* Input Text Layer */}
        <p 
          dir={isInputRTL ? 'rtl' : 'ltr'}
          className={`
            absolute inset-0
            text-base sm:text-lg md:text-xl 
            font-light leading-relaxed tracking-tight
            transition-all duration-1000 ease-in-out
            ${phase === 'input' 
              ? 'opacity-100 blur-0 translate-y-0' 
              : 'opacity-0 blur-[3px] -translate-y-2'
            }
            text-neutral-400
            ${isInputRTL ? 'text-right' : 'text-left'}
          `}
        >
          {scenario.input}
        </p>
        
        {/* Output Text Layer */}
        <p className={`
          absolute inset-0
          text-base sm:text-lg md:text-xl 
          font-light leading-relaxed tracking-tight
          transition-all duration-1000 ease-in-out
          ${phase === 'output' 
            ? 'opacity-100 blur-0 translate-y-0' 
            : 'opacity-0 blur-[3px] translate-y-2'
          }
          text-[#ededed]
        `}>
          {scenario.output}
        </p>
        
        {/* Processing State - Centered "Thinking" Animation */}
        <div className={`
          absolute inset-0 
          flex items-center justify-center
          transition-all duration-500 ease-in-out
          ${phase === 'processing' ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}>
          <div className="flex items-center gap-4">
            {/* Pulsing dots with stagger */}
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map(i => (
                <div 
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-white/40"
                  style={{
                    animation: 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    animationDelay: `${i * 150}ms`,
                  }}
                />
              ))}
            </div>
            <span className="text-[10px] tracking-[0.3em] uppercase text-neutral-500 font-medium">
              {scenario.mode === 'refinement' ? 'Refining' : 'Translating'}
            </span>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map(i => (
                <div 
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-white/40"
                  style={{
                    animation: 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    animationDelay: `${(i + 3) * 150}ms`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* ================================================================
          PROGRESS BAR - Ultra-subtle timing indicator
          ================================================================ */}
      <div className="mt-6 h-px bg-white/[0.04] rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-white/20 via-white/40 to-white/20 rounded-full transition-none"
          style={{ 
            width: `${progress}%`,
            transition: 'width 100ms linear',
          }}
        />
      </div>
    </div>
  );
});

OmniShowcase.displayName = 'OmniShowcase';

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
          <GlassCard isActive className="p-6 sm:p-8">
            <OmniShowcase />
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
              subtitle="Your API keys never leave localhost. Zero server transmission."
              className="md:col-span-2"
              delay={0}
            >
            <PrivacySchematic />
          </BentoCard>
          
          {/* Card B: Latency/Speed */}
            <BentoCard
              title="Sub-Second Inference"
              subtitle="Optimized for Gemini and Grok fast models."
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
