import React, { useState, useEffect, memo, useRef } from 'react';
import { Languages, Wand2, Globe2, Mic, BookOpen, Zap } from 'lucide-react';
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
  CollectioSection,
  GlossaryCard,
  ToneControlCard,
  type LegalModalType,
} from './LandingComponents';

// ============================================================================
// OMNI-SHOWCASE SCENARIOS — Demonstrating Verbum's Full Capabilities
// 16 scenarios covering translation, refinement, pivot, glossary, voice, diff
// ============================================================================

type ScenarioMode = 'translation' | 'refinement' | 'pivot' | 'glossary' | 'voice' | 'diff';

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

  // === NEW SCENARIOS ===
  {
    id: 'pt-en-glossary',
    mode: 'glossary',
    label: 'GLOSSARY POWERED',
    badge: 'PT → EN',
    icon: BookOpen,
    input: 'Vamos alinhar o prazo do contrato.',
    output: "Let's align on the agreement deadline.",
  },
  {
    id: 'en-en-diff',
    mode: 'diff',
    label: 'VISUAL DIFF',
    badge: 'CONCISE',
    icon: Zap,
    input: 'I wanted to reach out to you to let you know that we have decided to move forward with the project.',
    output: "We're proceeding with the project.",
  },
  {
    id: 'en-en-voice',
    mode: 'voice',
    label: 'VOICE INPUT',
    badge: 'EN',
    icon: Mic,
    input: 'Please review the proposal by Friday.',
    output: 'Please review the proposal by Friday.',
  },
  {
    id: 'he-en-pivot',
    mode: 'pivot',
    label: 'GLOBAL PIVOT',
    badge: 'HE → EN',
    icon: Globe2,
    input: 'נשמח לקבל את המשוב שלך',
    output: 'We would be happy to receive your feedback.',
  },
];

// ============================================================================
// OMNI-SHOWCASE COMPONENT
// ============================================================================

const OmniShowcase = memo(() => {
  const scenario = SCENARIOS[0];
  const Icon = scenario.icon;
  const isInputRTL = /[\u0600-\u06FF\u0590-\u05FF]/.test(scenario.input);

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="
            flex items-center gap-2
            px-3 py-1.5 rounded-full
            text-[10px] tracking-[0.2em] uppercase font-medium
            bg-white/[0.08] text-white border border-white/[0.12]
          ">
            <Icon size={12} />
            <span>{scenario.label}</span>
          </div>

          <div className="
            px-2.5 py-1 rounded-md
            text-[9px] tracking-[0.15em] uppercase font-semibold
            bg-white/[0.03] border border-white/[0.06] text-neutral-300
          ">
            {scenario.badge}
          </div>
        </div>

        <div className="text-[9px] tracking-[0.15em] text-neutral-500 font-mono tabular-nums">
          01/{String(SCENARIOS.length).padStart(2, '0')}
        </div>
      </div>

      <div className="space-y-5">
        <p
          dir={isInputRTL ? 'rtl' : 'ltr'}
          className={`
            text-sm sm:text-base font-light leading-relaxed tracking-tight text-neutral-500
            ${isInputRTL ? 'text-right' : 'text-left'}
          `}
        >
          {scenario.input}
        </p>

        <div className="h-px bg-white/[0.06]" />

        <p className="text-base sm:text-lg md:text-xl font-light leading-relaxed tracking-tight text-[#ededed]">
          {scenario.output}
        </p>
      </div>

      <div className="mt-6 h-px bg-white/[0.04] rounded-full overflow-hidden">
        <div className="h-full w-full bg-white/30 rounded-full" />
      </div>
    </div>
  );
});

OmniShowcase.displayName = 'OmniShowcase';

// ============================================================================
// BENTO CARD — Reusable
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
        <div className="p-6 pb-2">
          {children}
        </div>

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
  const heroVisible = true;
  const [activeModal, setActiveModal] = useState<LegalModalType>(null);
  const heroRef = useRef<HTMLElement>(null);

  return (
    <div className="
      min-h-screen min-h-[100dvh]
      flex flex-col
      selection:bg-white/20 selection:text-white
      overflow-x-hidden
    ">
      {/* Floating HUD Header */}
      <HUDHeader onLaunch={onEnter} />

      <main>
      {/* ================================================================
          HERO SECTION
          ================================================================ */}
      <section
        ref={heroRef}
        className="
          relative
          min-h-screen min-h-[100dvh]
          flex flex-col items-center justify-center
          px-6 py-20 pt-32
        "
      >
        <Spotlight containerRef={heroRef as React.RefObject<HTMLElement>} />

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
          ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
        `}>
          <div className="mb-8">
            <span className="
              text-[10px] tracking-[0.4em] uppercase
              text-neutral-400 font-medium
            ">
              Introducing
            </span>
          </div>

          <h1 className="
            text-5xl sm:text-6xl md:text-7xl
            font-light
            tracking-[-0.02em]
            text-[#ededed]
            mb-8
            leading-[1]
          ">
            Translate with
            <br />
            <span className="font-normal text-white">Confidence</span>
          </h1>

          <p className="
            text-lg sm:text-xl
            text-neutral-400
            font-light
            leading-relaxed
            max-w-2xl mx-auto
            mb-12
            tracking-tight
          ">
            For those who translate daily and are tired of not trusting the result.
            <br />
            <span className="text-neutral-500">No prompts. No waiting. No repeating yourself.</span>
          </p>

          <div className={`
            ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
          `}>
            <CTAButton onClick={onEnter}>
              Start Translating
            </CTAButton>
          </div>

        </div>

        {/* Hero Demo — OmniShowcase */}
        <div className={`
          relative z-10
          w-full max-w-2xl mx-auto
          mt-16
          ${heroVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}
        `}>
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
          FEATURE GRID — Bento V2
          ================================================================ */}
      <section
        id="capabilities"
        className="
          relative
          px-6 py-32
          max-w-6xl mx-auto w-full
        "
      >
        <div className="text-center mb-20">
          <span className="
            text-[10px] tracking-[0.4em] uppercase
            text-neutral-400 font-medium
            block mb-4
          ">
            Capabilities
          </span>
          <h2 className="
            text-3xl sm:text-4xl
            font-light
            tracking-[-0.02em]
            text-[#ededed]
          ">
            Built for How You Work
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <BentoCard
            title="Your Data Stays Yours"
            subtitle="Your API key never leaves your browser."
            className="md:col-span-2"
            delay={0}
          >
            <PrivacySchematic />
          </BentoCard>

          <BentoCard
            title="Fast Enough to Forget"
            subtitle="From thought to translation in under a second."
            delay={100}
          >
            <LatencyCounter />
          </BentoCard>

          <BentoCard
            title="Any Language, Either Way"
            subtitle="Write in Portuguese, Japanese, Arabic, or Hebrew."
            delay={200}
          >
            <SmartPivotAnimation />
          </BentoCard>

          <BentoCard
            title="See Exactly What Changed"
            subtitle="Character-level diff shows every adjustment."
            className="md:col-span-2"
            delay={300}
          >
            <MiniDiffViewer />
          </BentoCard>

          <BentoCard
            title="Sound How You Intend"
            subtitle="Executive, concise, diplomatic — or your own voice."
            delay={400}
          >
            <ToneControlCard />
          </BentoCard>

          <BentoCard
            title="Your Terms, Remembered"
            subtitle="Define once. Applied to every translation."
            delay={500}
          >
            <GlossaryCard />
          </BentoCard>
        </div>
      </section>

      {/* ================================================================
          USE CASES SECTION
          ================================================================ */}
      <UseCaseSection />

      {/* ================================================================
          COLLECTIO
          ================================================================ */}
      <div id="collectio">
        <CollectioSection />
      </div>

      {/* ================================================================
          CREATOR STATEMENT
          ================================================================ */}
      <CreatorStatement />
      </main>

      {/* ================================================================
          ENHANCED FOOTER
          ================================================================ */}
      <EnhancedFooter onOpenModal={setActiveModal} />

      <LegalModal type={activeModal} onClose={() => setActiveModal(null)} />

      <GlobalKeyListener onEnter={onEnter} />
    </div>
  );
};

export default LandingPage;
