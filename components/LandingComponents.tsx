import React, { useState, useEffect, memo, useRef, useCallback, useMemo } from 'react';
import { 
  ArrowRight, 
  Globe, 
  Shield, 
  GitCompareArrows, 
  Sparkles,
  Lock,
  Database,
  Zap,
  Server,
  ArrowLeftRight,
  Mail,
  FileText,
  Scale,
  Quote
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { useRollingNumber } from '../hooks/useRollingNumber';

// ============================================================================
// DESIGN TOKENS
// ============================================================================
export const ANIMATION_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';
export const TEXT_PRIMARY = '#ededed';
export const TEXT_SECONDARY = '#a3a3a3';
export const TEXT_TERTIARY = '#737373';
export const TEXT_MUTED = '#525252';

// ============================================================================
// FLOATING HUD HEADER - Minimal
// ============================================================================
interface HUDHeaderProps {
  onLaunch: () => void;
}

export const HUDHeader = memo<HUDHeaderProps>(({ onLaunch }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`
      fixed top-0 left-0 right-0 z-50
      transition-all duration-500 ease-[${ANIMATION_EASING}]
      ${isScrolled 
        ? 'py-3 bg-black/60 backdrop-blur-xl border-b border-white/[0.04]' 
        : 'py-5 bg-transparent'
      }
    `}>
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
        {/* Wordmark */}
        <span className={`
          text-base font-light tracking-[0.08em]
          transition-colors duration-300
          ${isScrolled ? 'text-white' : 'text-[${TEXT_PRIMARY}]'}
        `}>
          Verbum
        </span>
        
        {/* Launch Button */}
        <button
          onClick={onLaunch}
          className="
            px-4 py-2 rounded-lg
            text-[11px] tracking-[0.1em] uppercase font-medium
            text-neutral-400
            border border-white/[0.08]
            bg-white/[0.02]
            
            transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
            
            hover:text-white
            hover:border-white/[0.15]
            hover:bg-white/[0.05]
            
            active:scale-[0.98]
          "
        >
          Launch
        </button>
      </div>
    </header>
  );
});

HUDHeader.displayName = 'HUDHeader';

// ============================================================================
// SPOTLIGHT EFFECT - Mouse following gradient
// ============================================================================
interface SpotlightProps {
  containerRef: React.RefObject<HTMLElement>;
}

export const Spotlight = memo<SpotlightProps>(({ containerRef }) => {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isActive, setIsActive] = useState(false);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setPosition({ x, y });
    };
    
    const handleMouseEnter = () => setIsActive(true);
    const handleMouseLeave = () => setIsActive(false);
    
    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [containerRef]);

  return (
    <div 
      className={`
        absolute inset-0 pointer-events-none
        transition-opacity duration-700
        ${isActive ? 'opacity-100' : 'opacity-0'}
      `}
      style={{
        background: `radial-gradient(600px circle at ${position.x}% ${position.y}%, rgba(255,255,255,0.03), transparent 40%)`
      }}
    />
  );
});

Spotlight.displayName = 'Spotlight';

// ============================================================================
// PRIVACY SCHEMATIC CARD - CSS-only visualization
// ============================================================================
export const PrivacySchematic = memo(() => {
  const [animationPhase, setAnimationPhase] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationPhase(prev => (prev + 1) % 4);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-32 flex items-center justify-center">
      {/* Connection Line - Broken */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center">
        <div className="flex items-center gap-3 w-full max-w-[200px]">
          {/* Local Device */}
          <div className={`
            relative p-3 rounded-xl
            bg-white/[0.04] border border-white/[0.08]
            transition-all duration-500
            ${animationPhase >= 1 ? 'border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : ''}
          `}>
            <Lock size={18} className={`
              transition-colors duration-500
              ${animationPhase >= 1 ? 'text-emerald-500/80' : 'text-neutral-500'}
            `} />
            <span className="
              absolute -bottom-5 left-1/2 -translate-x-1/2
              text-[8px] tracking-[0.15em] uppercase text-neutral-600
              whitespace-nowrap
            ">
              Your Key
            </span>
          </div>
          
          {/* Broken Line */}
          <div className="flex-1 flex items-center justify-center gap-1">
            <div className={`
              h-px flex-1
              transition-all duration-500
              ${animationPhase >= 2 ? 'bg-emerald-500/40' : 'bg-white/10'}
            `} />
            <div className={`
              w-2 h-2 rounded-full border-2
              transition-all duration-500
              ${animationPhase >= 2 
                ? 'border-emerald-500/60 bg-emerald-500/20' 
                : 'border-white/20 bg-transparent'
              }
            `} />
            <div className={`
              h-px w-4
              transition-all duration-500
              ${animationPhase >= 2 ? 'bg-transparent' : 'bg-white/10'}
            `}>
              {animationPhase >= 2 && (
                <div className="flex items-center justify-center h-full">
                  <span className="text-[8px] text-red-500/60">×</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Server - Crossed Out */}
          <div className={`
            relative p-3 rounded-xl
            bg-white/[0.02] border border-white/[0.04]
            transition-all duration-500
            ${animationPhase >= 3 ? 'opacity-30' : 'opacity-60'}
          `}>
            <Server size={18} className="text-neutral-600" />
            {animationPhase >= 3 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-px bg-red-500/50 rotate-45" />
              </div>
            )}
            <span className="
              absolute -bottom-5 left-1/2 -translate-x-1/2
              text-[8px] tracking-[0.15em] uppercase text-neutral-700
              whitespace-nowrap
            ">
              No Server
            </span>
          </div>
        </div>
      </div>
      
      {/* LocalStorage indicator */}
      <div className={`
        absolute bottom-0 left-1/2 -translate-x-1/2
        flex items-center gap-2
        px-3 py-1.5 rounded-full
        bg-white/[0.02] border border-white/[0.04]
        transition-all duration-500
        ${animationPhase >= 1 ? 'opacity-100' : 'opacity-0'}
      `}>
        <Database size={10} className="text-neutral-500" />
        <span className="text-[9px] tracking-[0.1em] text-neutral-500 font-mono">
          localStorage
        </span>
      </div>
    </div>
  );
});

PrivacySchematic.displayName = 'PrivacySchematic';

// ============================================================================
// LATENCY COUNTER CARD - Live oscillating ms
// ============================================================================
export const LatencyCounter = memo(() => {
  const [targetMs, setTargetMs] = useState(67);
  const { formattedValue } = useRollingNumber(targetMs, { 
    duration: 400, 
    decimals: 0,
    easing: 'cubic'
  });
  
  useEffect(() => {
    const interval = setInterval(() => {
      // Oscillate between 45-120ms for realistic feel
      setTargetMs(Math.floor(45 + Math.random() * 75));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const getLatencyColor = (ms: number) => {
    if (ms < 60) return 'text-emerald-400';
    if (ms < 90) return 'text-amber-400';
    return 'text-orange-400';
  };

  return (
    <div className="relative h-32 flex flex-col items-center justify-center">
      {/* Main Counter */}
      <div className="flex items-baseline gap-1">
        <span className={`
          text-4xl font-light tracking-tight
          font-[tabular-nums]
          transition-colors duration-300
          ${getLatencyColor(targetMs)}
        `}>
          {formattedValue}
        </span>
        <span className="text-sm text-neutral-600 font-light">ms</span>
      </div>
      
      {/* Label */}
      <div className="mt-3 flex items-center gap-2">
        <Zap size={12} className="text-neutral-500" />
        <span className="text-[10px] tracking-[0.15em] uppercase text-neutral-500">
          Inference Latency
        </span>
      </div>
      
      {/* Pulse Ring */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`
          w-20 h-20 rounded-full
          border border-current opacity-10
          animate-ping
          ${getLatencyColor(targetMs)}
        `} style={{ animationDuration: '2s' }} />
      </div>
    </div>
  );
});

LatencyCounter.displayName = 'LatencyCounter';

// ============================================================================
// MINI DIFF VIEWER
// ============================================================================
export const MiniDiffViewer = memo(() => {
  const [showDiff, setShowDiff] = useState(true);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setShowDiff(prev => !prev);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-32 flex flex-col items-center justify-center px-4">
      <div className="w-full space-y-2">
        {/* Original Line */}
        <div className={`
          flex items-center gap-2
          transition-all duration-500
          ${showDiff ? 'opacity-100' : 'opacity-40'}
        `}>
          <span className="text-[10px] text-red-400/60 font-mono">−</span>
          <span className={`
            text-sm font-light
            transition-all duration-500
            ${showDiff 
              ? 'text-neutral-500 line-through decoration-red-500/30' 
              : 'text-neutral-400'
            }
          `}>
            i think we should meet
          </span>
        </div>
        
        {/* Transformed Line */}
        <div className={`
          flex items-center gap-2
          transition-all duration-500
          ${showDiff ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
        `}>
          <span className="text-[10px] text-emerald-400/60 font-mono">+</span>
          <span className="text-sm font-light text-[${TEXT_PRIMARY}]">
            I propose we convene
          </span>
        </div>
      </div>
      
      {/* Status Indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
        <span className="text-[9px] tracking-[0.15em] uppercase text-neutral-600">
          {showDiff ? 'Changes Highlighted' : 'Original Text'}
        </span>
      </div>
    </div>
  );
});

MiniDiffViewer.displayName = 'MiniDiffViewer';

// ============================================================================
// SMART PIVOT ANIMATION - Global Language Matrix
// Cycles through diverse language pairs to demonstrate multi-language support
// ============================================================================

/** Language pairs showcasing global capability: diverse scripts and regions */
const PIVOT_SEQUENCE: Array<{ source: string; target: string }> = [
  { source: 'PT', target: 'EN' },
  { source: 'JA', target: 'EN' },
  { source: 'AR', target: 'EN' },
  { source: 'DE', target: 'EN' },
  { source: 'ZH', target: 'EN' },
  { source: 'RU', target: 'EN' },
];

export const SmartPivotAnimation = memo(() => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isReversed, setIsReversed] = useState(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setIsReversed(prev => {
        if (!prev) {
          return true;
        } else {
          // Move to next pair when completing a full cycle
          setCurrentIndex(i => (i + 1) % PIVOT_SEQUENCE.length);
          return false;
        }
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const currentPair = PIVOT_SEQUENCE[currentIndex];
  const sourceCode = isReversed ? currentPair.target : currentPair.source;
  const targetCode = isReversed ? currentPair.source : currentPair.target;

  return (
    <div className="relative h-32 flex items-center justify-center">
      <div className="flex items-center gap-4">
        {/* Source Language */}
        <div className={`
          px-4 py-2 rounded-lg min-w-[52px] text-center
          border transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
          bg-white/[0.06] border-white/[0.12] text-white
        `}>
          <span className="text-sm font-medium tracking-wide">
            {sourceCode}
          </span>
        </div>
        
        {/* Arrow */}
        <div className="relative">
          <ArrowLeftRight 
            size={20} 
            className={`
              text-neutral-500
              transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
              ${isReversed ? 'rotate-180' : 'rotate-0'}
            `}
          />
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
            <span className="text-[8px] tracking-[0.2em] uppercase text-neutral-600">
              Auto
            </span>
          </div>
        </div>
        
        {/* Target Language */}
        <div className={`
          px-4 py-2 rounded-lg min-w-[52px] text-center
          border transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
          bg-white/[0.02] border-white/[0.04] text-neutral-500
        `}>
          <span className="text-sm font-medium tracking-wide">
            {targetCode}
          </span>
        </div>
      </div>
      
      {/* Language Count Indicator */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
        <span className="text-[9px] tracking-[0.15em] uppercase text-neutral-700">
          15+ Languages
        </span>
      </div>
    </div>
  );
});

SmartPivotAnimation.displayName = 'SmartPivotAnimation';

// ============================================================================
// USE CASE SECTION
// ============================================================================
const USE_CASES = [
  {
    id: 'email',
    icon: Mail,
    title: 'Email Communication',
    preview: {
      before: "hey, just wanted to check if you got my last message about the budget",
      after: "I wanted to follow up regarding my previous correspondence concerning the budget allocation."
    }
  },
  {
    id: 'docs',
    icon: FileText,
    title: 'Technical Documentation',
    preview: {
      before: "this function takes a string and returns the processed result",
      after: "This method accepts a string parameter and returns the processed output upon successful execution."
    }
  },
  {
    id: 'legal',
    icon: Scale,
    title: 'Legal Correspondence',
    preview: {
      before: "we need to talk about the contract terms before signing",
      after: "Prior to execution, we must convene to discuss the contractual provisions in detail."
    }
  }
];

export const UseCaseSection = memo(() => {
  const [activeCase, setActiveCase] = useState(USE_CASES[0]);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleCaseChange = useCallback((useCase: typeof USE_CASES[0]) => {
    if (useCase.id === activeCase.id) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveCase(useCase);
      setIsTransitioning(false);
    }, 200);
  }, [activeCase.id]);

  return (
    <section id="use-cases" className="relative px-6 py-32 max-w-6xl mx-auto w-full">
      {/* Section Header */}
      <div className="text-center mb-16">
        <span className="
          text-[10px] tracking-[0.4em] uppercase
          text-neutral-600 font-medium
          block mb-4
        ">
          Applications
        </span>
        <h2 className={`
          text-3xl sm:text-4xl
          font-light
          tracking-[-0.02em]
          text-[${TEXT_PRIMARY}]
        `}>
          The Executive Standard
        </h2>
      </div>
      
      {/* Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Use Case List */}
        <div className="space-y-3">
          {USE_CASES.map((useCase) => {
            const Icon = useCase.icon;
            const isActive = activeCase.id === useCase.id;
            
            return (
              <button
                key={useCase.id}
                onClick={() => handleCaseChange(useCase)}
                className={`
                  w-full p-5 rounded-xl
                  text-left
                  border transition-all duration-300 ease-[${ANIMATION_EASING}]
                  
                  ${isActive 
                    ? 'bg-white/[0.04] border-white/[0.1] shadow-[0_0_30px_rgba(255,255,255,0.02)]' 
                    : 'bg-transparent border-white/[0.04] hover:border-white/[0.08] hover:bg-white/[0.02]'
                  }
                `}
              >
                <div className="flex items-center gap-4">
                  <div className={`
                    w-10 h-10 rounded-lg
                    flex items-center justify-center
                    transition-all duration-300
                    ${isActive 
                      ? 'bg-white/[0.08] text-white' 
                      : 'bg-white/[0.02] text-neutral-500'
                    }
                  `}>
                    <Icon size={18} strokeWidth={1.5} />
                  </div>
                  <div>
                    <span className={`
                      text-sm font-medium tracking-tight
                      transition-colors duration-300
                      ${isActive ? 'text-white' : 'text-neutral-400'}
                    `}>
                      {useCase.title}
                    </span>
                  </div>
                  {isActive && (
                    <ArrowRight size={16} className="ml-auto text-neutral-500" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
        
        {/* Right: Preview Card */}
        <GlassCard className="p-8 h-full min-h-[300px]" isActive>
          <div className={`
            transition-all duration-200
            ${isTransitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}
          `}>
            {/* Before */}
            <div className="mb-6">
              <span className="
                text-[10px] tracking-[0.2em] uppercase
                text-neutral-600 font-medium
                block mb-3
              ">
                Input
              </span>
              <p className="text-neutral-500 font-light leading-relaxed">
                "{activeCase.preview.before}"
              </p>
            </div>
            
            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <Sparkles size={14} className="text-neutral-600" />
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>
            
            {/* After */}
            <div>
              <span className="
                text-[10px] tracking-[0.2em] uppercase
                text-neutral-600 font-medium
                block mb-3
              ">
                Output
              </span>
              <p className={`text-[${TEXT_PRIMARY}] font-light leading-relaxed`}>
                "{activeCase.preview.after}"
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </section>
  );
});

UseCaseSection.displayName = 'UseCaseSection';

// ============================================================================
// CREATOR STATEMENT SECTION
// ============================================================================
export const CreatorStatement = memo(() => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section 
      ref={ref}
      className="relative px-6 py-32 max-w-4xl mx-auto w-full"
    >
      <div className={`
        transition-all duration-1000 ease-[${ANIMATION_EASING}]
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
      `}>
        {/* Quote Icon */}
        <div className="flex justify-center mb-8">
          <div className="
            w-12 h-12 rounded-full
            bg-white/[0.02] border border-white/[0.06]
            flex items-center justify-center
          ">
            <Quote size={20} className="text-neutral-600" />
          </div>
        </div>
        
        {/* Statement */}
        <blockquote className="text-center">
          <p className={`
            text-xl sm:text-2xl
            font-light
            leading-relaxed
            text-[${TEXT_SECONDARY}]
            mb-8
            max-w-3xl mx-auto
          `}>
            "I communicate globally in professional contexts daily. 
            While fluent in English, I never felt fully confident in high-stakes correspondence. 
            Existing tools required constant context-setting. 
            <span className="text-white"> Verbum exists because precision in communication shouldn't require explanation.</span>"
          </p>
          
          {/* Attribution */}
          <footer className="flex flex-col items-center gap-2">
            <cite className={`
              text-sm font-medium tracking-tight
              text-[${TEXT_PRIMARY}]
              not-italic
            `}>
              F. Miguel Pacheco
            </cite>
            <span className="
              text-[10px] tracking-[0.2em] uppercase
              text-neutral-600
            ">
              Creator & Engineer
            </span>
          </footer>
        </blockquote>
      </div>
    </section>
  );
});

CreatorStatement.displayName = 'CreatorStatement';

// ============================================================================
// LEGAL MODAL - Reusable Modal for Privacy, Terms, License
// ============================================================================
export type LegalModalType = 'privacy' | 'terms' | 'license' | null;

interface LegalModalProps {
  type: LegalModalType;
  onClose: () => void;
}

const LEGAL_CONTENT: Record<Exclude<LegalModalType, null>, { title: string; content: React.ReactNode }> = {
  privacy: {
    title: 'Privacy Policy',
    content: (
      <div className="space-y-6">
        <section>
          <h3 className="text-sm font-medium text-[#ededed] mb-3">Data Processing</h3>
          <p className="text-sm text-neutral-500 leading-relaxed">
            Verbum operates entirely within your browser. Your API key and all text content are processed locally 
            and transmitted directly to Google Gemini or xAI Grok APIs. No data passes through intermediate servers.
          </p>
        </section>
        <section>
          <h3 className="text-sm font-medium text-[#ededed] mb-3">Local Storage</h3>
          <p className="text-sm text-neutral-500 leading-relaxed">
            Your API key is stored in your browser's localStorage for convenience. Session history is maintained 
            in memory only and cleared when you close the application. No persistent logging occurs.
          </p>
        </section>
        <section>
          <h3 className="text-sm font-medium text-[#ededed] mb-3">Third-Party Services</h3>
          <p className="text-sm text-neutral-500 leading-relaxed">
            This application uses Google Gemini and xAI Grok APIs for translation and refinement. Your text content is subject to 
            their respective data handling policies when transmitted to their servers. Review each provider's AI terms 
            for complete information.
          </p>
        </section>
        <section>
          <h3 className="text-sm font-medium text-[#ededed] mb-3">Contact</h3>
          <p className="text-sm text-neutral-500 leading-relaxed">
            For privacy inquiries, contact the author via GitHub.
          </p>
        </section>
      </div>
    )
  },
  terms: {
    title: 'Terms of Use',
    content: (
      <div className="space-y-6">
        <section>
          <h3 className="text-sm font-medium text-[#ededed] mb-3">Acceptance</h3>
          <p className="text-sm text-neutral-500 leading-relaxed">
            By using Verbum, you agree to these terms. If you do not agree, please do not use the application.
          </p>
        </section>
        <section>
          <h3 className="text-sm font-medium text-[#ededed] mb-3">Service Description</h3>
          <p className="text-sm text-neutral-500 leading-relaxed">
            Verbum is a client-side translation interface that connects to Google Gemini and xAI Grok APIs using your 
            personal API keys. The application facilitates translation and tone refinement for your text content.
          </p>
        </section>
        <section>
          <h3 className="text-sm font-medium text-[#ededed] mb-3">User Responsibilities</h3>
          <p className="text-sm text-neutral-500 leading-relaxed">
            You are responsible for securing your API keys, complying with Google and xAI terms of service, and 
            ensuring your use of the translation service adheres to applicable laws. You agree not to use 
            this service for harmful, illegal, or unethical purposes.
          </p>
        </section>
        <section>
          <h3 className="text-sm font-medium text-[#ededed] mb-3">Disclaimer</h3>
          <p className="text-sm text-neutral-500 leading-relaxed">
            This application is provided "as is" without warranty. The author is not liable for any damages 
            arising from use, including translation inaccuracies or service interruptions.
          </p>
        </section>
      </div>
    )
  },
  license: {
    title: 'MIT License',
    content: (
      <div className="space-y-6">
        <section>
          <p className="text-sm text-neutral-500 leading-relaxed font-mono">
            MIT License
          </p>
          <p className="text-sm text-neutral-500 leading-relaxed mt-4">
            Copyright © 2025 Fábio Miguel Denda Pacheco
          </p>
        </section>
        <section>
          <p className="text-sm text-neutral-500 leading-relaxed">
            Permission is hereby granted, free of charge, to any person obtaining a copy of this software 
            and associated documentation files (the "Software"), to deal in the Software without restriction, 
            including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, 
            and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, 
            subject to the following conditions:
          </p>
        </section>
        <section>
          <p className="text-sm text-neutral-500 leading-relaxed">
            The above copyright notice and this permission notice shall be included in all copies or substantial 
            portions of the Software.
          </p>
        </section>
        <section>
          <p className="text-sm text-neutral-500 leading-relaxed uppercase text-[11px] tracking-wide">
            THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT 
            NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
            IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, 
            WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
            SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
          </p>
        </section>
      </div>
    )
  }
};

export const LegalModal = memo<LegalModalProps>(({ type, onClose }) => {
  // Close on Escape
  useEffect(() => {
    if (!type) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [type, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (type) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [type]);

  if (!type) return null;

  const { title, content } = LEGAL_CONTENT[type];

  return (
    <div 
      className="
        fixed inset-0 z-[100]
        flex items-center justify-center
        p-6
        animate-[fadeIn_200ms_ease-out_forwards]
      "
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="
          relative z-10
          w-full max-w-lg max-h-[80vh]
          bg-neutral-950 border border-white/[0.08]
          rounded-2xl shadow-2xl
          overflow-hidden
          animate-[scaleIn_300ms_cubic-bezier(0.16,1,0.3,1)_forwards]
        "
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-base font-medium text-[#ededed] tracking-tight">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="
              w-8 h-8 rounded-lg
              flex items-center justify-center
              text-neutral-500 hover:text-white
              bg-white/[0.02] hover:bg-white/[0.06]
              border border-white/[0.04] hover:border-white/[0.08]
              transition-all duration-200
            "
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="px-6 py-6 overflow-y-auto max-h-[60vh]">
          {content}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] bg-white/[0.01]">
          <p className="text-[10px] tracking-[0.1em] text-neutral-600 text-center">
            Last updated: December 4, 2025
          </p>
        </div>
      </div>
    </div>
  );
});

LegalModal.displayName = 'LegalModal';

// ============================================================================
// ENHANCED FOOTER
// ============================================================================
interface EnhancedFooterProps {
  onOpenModal?: (type: LegalModalType) => void;
}

export const EnhancedFooter = memo<EnhancedFooterProps>(({ onOpenModal }) => {
  const handleScrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <footer className="relative px-6 py-20 border-t border-white/[0.04]">
      <div className="max-w-6xl mx-auto">
        {/* Main Footer Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-16">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            <span className={`text-lg font-light tracking-tight text-[${TEXT_PRIMARY}] block mb-4`}>
              Verbum
            </span>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Neural translation engineered for executive communication.
            </p>
          </div>
          
          {/* Product */}
          <div>
            <span className="text-[10px] tracking-[0.2em] uppercase text-neutral-500 font-medium block mb-4">
              Product
            </span>
            <ul className="space-y-3">
              <li>
                <button 
                  onClick={() => handleScrollTo('capabilities')}
                  className="
                    text-sm text-neutral-600 text-left
                    hover:text-neutral-400
                    transition-colors duration-300
                  "
                >
                  Capabilities
                </button>
              </li>
            </ul>
          </div>
          
          {/* Resources */}
          <div>
            <span className="text-[10px] tracking-[0.2em] uppercase text-neutral-500 font-medium block mb-4">
              Resources
            </span>
            <ul className="space-y-3">
              <li>
                <button 
                  onClick={() => handleScrollTo('use-cases')}
                  className="
                    text-sm text-neutral-600 text-left
                    hover:text-neutral-400
                    transition-colors duration-300
                  "
                >
                  Use Cases
                </button>
              </li>
              <li>
                <a 
                  href="https://github.com/fabiomigueldp/Verbum" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    text-sm text-neutral-600
                    hover:text-neutral-400
                    transition-colors duration-300
                  "
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>
          
          {/* Legal */}
          <div>
            <span className="text-[10px] tracking-[0.2em] uppercase text-neutral-500 font-medium block mb-4">
              Legal
            </span>
            <ul className="space-y-3">
              <li>
                <button 
                  onClick={() => onOpenModal?.('privacy')}
                  className="
                    text-sm text-neutral-600 text-left
                    hover:text-neutral-400
                    transition-colors duration-300
                  "
                >
                  Privacy
                </button>
              </li>
              <li>
                <button 
                  onClick={() => onOpenModal?.('terms')}
                  className="
                    text-sm text-neutral-600 text-left
                    hover:text-neutral-400
                    transition-colors duration-300
                  "
                >
                  Terms
                </button>
              </li>
              <li>
                <button 
                  onClick={() => onOpenModal?.('license')}
                  className="
                    text-sm text-neutral-600 text-left
                    hover:text-neutral-400
                    transition-colors duration-300
                  "
                >
                  License
                </button>
              </li>
            </ul>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="
          pt-8 border-t border-white/[0.04]
          flex flex-col sm:flex-row items-center justify-center gap-2
          text-center
        ">
          <span className="text-[11px] tracking-[0.05em] text-neutral-600">
            © 2025 Fábio Miguel Denda Pacheco
          </span>
          <span className="hidden sm:inline text-neutral-700">·</span>
          <span className="text-[11px] tracking-[0.05em] text-neutral-600">
            MIT License
          </span>
        </div>
      </div>
    </footer>
  );
});

EnhancedFooter.displayName = 'EnhancedFooter';

// ============================================================================
// CTA BUTTON (Exported from original)
// ============================================================================
export const CTAButton = memo<{ onClick: () => void; children: React.ReactNode }>(({ onClick, children }) => (
  <button
    onClick={onClick}
    className="
      group relative overflow-hidden
      px-10 py-5 rounded-xl
      
      bg-white text-neutral-900
      font-medium text-base tracking-tight
      
      shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_4px_24px_rgba(0,0,0,0.4),0_0_60px_rgba(255,255,255,0.1)]
      
      transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
      
      hover:shadow-[0_0_0_1px_rgba(255,255,255,0.3),0_8px_40px_rgba(0,0,0,0.5),0_0_80px_rgba(255,255,255,0.15)]
      hover:-translate-y-0.5
      
      active:translate-y-0
      active:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_2px_12px_rgba(0,0,0,0.3),0_0_40px_rgba(255,255,255,0.08)]
      active:scale-[0.99]
      
      focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30
    "
  >
    <span className="
      absolute inset-0 
      bg-gradient-to-r from-transparent via-black/[0.03] to-transparent
      translate-x-[-100%] group-hover:translate-x-[100%]
      transition-transform duration-700
    " />
    
    <span className="relative z-10 flex items-center gap-3">
      {children}
      <ArrowRight 
        size={18} 
        className="transition-transform duration-300 group-hover:translate-x-1" 
      />
    </span>
  </button>
));

CTAButton.displayName = 'CTAButton';

// ============================================================================
// GLOBAL KEYBOARD LISTENER
// ============================================================================
export const GlobalKeyListener: React.FC<{ onEnter: () => void }> = ({ onEnter }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        onEnter();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onEnter]);
  
  return null;
};
