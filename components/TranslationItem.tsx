import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Copy, Check, Eye, EyeOff, Volume2, Trash2, StopCircle } from 'lucide-react';
import { TranslationRecord, SUPPORTED_LANGUAGES } from '../types';
import { GlassCard } from './GlassCard';

// ============================================================================
// DESIGN SYSTEM: Cinematic Translation Item
// Premium content materialization with calm, subtle animations
// ============================================================================

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Detects if text contains predominantly RTL characters (Arabic, Hebrew)
 */
const detectRTL = (text: string): boolean => {
  if (!text || text.trim().length === 0) return false;
  const rtlChars = text.match(/[\u0590-\u05FF\uFB1D-\uFB4F\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/g);
  const ltrChars = text.match(/[A-Za-z\u00C0-\u024F\u0100-\u017F]/g);
  
  if (!rtlChars) return false;
  if (!ltrChars) return true;
  
  return rtlChars.length / (rtlChars.length + ltrChars.length) > 0.3;
};

/**
 * Gets RTL status from language code
 */
const isLanguageRTL = (langCode: string): boolean => {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
  return lang?.dir === 'rtl';
};

/**
 * TTS Language mapping - BCP 47 tags for Web Speech API
 */
const getTTSLanguageTag = (langCode: string): string => {
  const langMap: Record<string, string> = {
    'pt': 'pt-BR',
    'en': 'en-US',
    'es': 'es-ES',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'it': 'it-IT',
    'ja': 'ja-JP',
    'zh': 'zh-CN',
    'ru': 'ru-RU',
    // New languages
    'la': 'la',       // Latin - limited TTS support, falls back
    'el': 'el-GR',    // Greek
    'ko': 'ko-KR',    // Korean
    'ar': 'ar-SA',    // Arabic (Saudi Arabia)
    'he': 'he-IL',    // Hebrew
    'hi': 'hi-IN',    // Hindi
  };
  
  return langMap[langCode] || 'en-US';
};

interface TranslationItemProps {
  item: TranslationRecord;
  onDelete: (id: string) => void;
  isNew?: boolean; // Flag for subtle arrival emphasis
}

// ============================================================================
// Action Button Primitive
// Unified micro-interaction styling for all action buttons
// ============================================================================
interface ActionButtonProps {
  onClick: () => void;
  title: string;
  isActive?: boolean;
  variant?: 'default' | 'danger';
  children: React.ReactNode;
  delay?: number;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  title,
  isActive = false,
  variant = 'default',
  children,
  delay = 0,
}) => {
  const baseClasses = `
    relative p-2 rounded-full
    transition-all duration-300 ease-out
    backdrop-blur-sm
    border border-transparent
    group/btn
  `;
  
  const variantClasses = variant === 'danger'
    ? `text-neutral-600 
       hover:text-neutral-300 
       hover:bg-white/[0.03] 
       hover:border-white/[0.06]
       hover:shadow-[0_0_12px_0_rgba(255,255,255,0.03)]`
    : isActive
      ? `text-white 
         bg-white/[0.08] 
         border-white/[0.1]
         shadow-[0_0_16px_0_rgba(255,255,255,0.06)]`
      : `text-neutral-500 
         hover:text-white 
         hover:bg-white/[0.04]
         hover:border-white/[0.08]
         hover:shadow-[0_0_12px_0_rgba(255,255,255,0.03)]`;

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variantClasses}`}
      title={title}
      style={{
        animationDelay: `${delay}ms`,
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* Subtle inner glow on hover */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
      <span className="relative z-10">{children}</span>
    </button>
  );
};

// ============================================================================
// Language Chip
// Dynamic display based on actual translation direction
// ============================================================================
interface LanguageChipProps {
  sourceLang: string;
  targetLang: string;
  delay?: number;
}

const LanguageChip: React.FC<LanguageChipProps> = ({ sourceLang, targetLang, delay = 0 }) => {
  // Format: SOURCE → TARGET (uppercase codes)
  const sourceCode = sourceLang === 'unknown' ? '??' : sourceLang.toUpperCase();
  const targetCode = targetLang.toUpperCase();
  const direction = `${sourceCode} → ${targetCode}`;
  
  return (
    <span 
      className="
        inline-flex items-center justify-center
        h-[22px] min-w-[80px] px-2
        text-[10px] font-semibold tracking-[0.15em] uppercase
        text-neutral-400
        bg-white/[0.02]
        border border-white/[0.08]
        rounded-md
        select-none
      "
      style={{
        animationDelay: `${delay}ms`,
        fontVariantNumeric: 'tabular-nums',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {direction}
    </span>
  );
};

// ============================================================================
// Timestamp Display
// Tabular numbers, technical aesthetic
// ============================================================================
interface TimestampProps {
  timestamp: number;
  delay?: number;
}

const Timestamp: React.FC<TimestampProps> = ({ timestamp, delay = 0 }) => {
  const formattedTime = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));

  return (
    <span 
      className="
        text-[10px] text-neutral-600 
        font-medium tracking-wider
        select-none
      "
      style={{
        animationDelay: `${delay}ms`,
        fontVariantNumeric: 'tabular-nums',
        fontFeatureSettings: '"tnum" 1',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {formattedTime}
    </span>
  );
};

// ============================================================================
// Main Component: TranslationItem
// Cinematic content materialization with zero CLS
// ============================================================================
export const TranslationItem: React.FC<TranslationItemProps> = ({ 
  item, 
  onDelete,
  isNew = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  
  // Capture initial isNew value to prevent re-render flickering
  // This ensures animation classes are stable throughout the component lifecycle
  const wasNewOnMount = useRef(isNew);
  const shouldAnimate = wasNewOnMount.current;

  // RTL Detection - for translation and original text
  const translationDirection = useMemo(() => {
    // First check language config, then detect from content
    if (isLanguageRTL(item.targetLang)) return 'rtl';
    return detectRTL(item.translation) ? 'rtl' : 'ltr';
  }, [item.translation, item.targetLang]);

  const originalDirection = useMemo(() => {
    if (isLanguageRTL(item.sourceLang)) return 'rtl';
    return detectRTL(item.original) ? 'rtl' : 'ltr';
  }, [item.original, item.sourceLang]);

  const handleCopy = async () => {
    try {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(item.translation);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = item.translation;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  const handleSpeak = (text: string, lang: string) => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Use the centralized TTS language mapping
    utterance.lang = getTTSLanguageTag(lang);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;

    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    setIsPlaying(true);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div 
      ref={itemRef}
      className={`
        group mb-4 
        ${shouldAnimate ? 'animate-content-enter' : ''}
      `}
    >
      <GlassCard className="relative overflow-hidden" hoverEffect={true}>
        {/* Top-left ambient glow - matches skeleton */}
        <div 
          className="absolute top-0 left-0 w-32 h-32 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at top left, rgba(255,255,255,0.015) 0%, transparent 70%)',
          }}
        />

        {/* Content Layer */}
        <div className="p-6 relative z-10">
          {/* ============================================
              Header: Language Chip + Timestamp + Actions
              Pixel-perfect match with LiquidSkeleton
              ============================================ */}
          <div className="flex justify-between items-start mb-4">
            {/* Left: Language direction + timestamp */}
            <div className="flex items-center gap-3">
              <LanguageChip sourceLang={item.sourceLang} targetLang={item.targetLang} delay={0} />
              <Timestamp timestamp={item.timestamp} delay={50} />
            </div>
            
            {/* Right: Action buttons - reveal on hover */}
            <div 
              className="
                flex gap-1 
                opacity-0 group-hover:opacity-100 
                transition-all duration-500 ease-out
                transform translate-x-2 group-hover:translate-x-0
              "
            >
              <ActionButton
                onClick={() => handleSpeak(item.translation, item.targetLang)}
                title="Listen"
                isActive={isPlaying}
                delay={100}
              >
                {isPlaying ? <StopCircle size={14} /> : <Volume2 size={14} />}
              </ActionButton>
              
              <ActionButton
                onClick={() => setShowOriginal(!showOriginal)}
                title={showOriginal ? "Hide Original" : "Show Original"}
                isActive={showOriginal}
                delay={150}
              >
                {showOriginal ? <EyeOff size={14} /> : <Eye size={14} />}
              </ActionButton>
              
              <ActionButton
                onClick={handleCopy}
                title="Copy"
                isActive={copied}
                delay={200}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </ActionButton>
              
              <ActionButton
                onClick={() => onDelete(item.id)}
                title="Delete"
                variant="danger"
                delay={250}
              >
                <Trash2 size={14} />
              </ActionButton>
            </div>
          </div>

          {/* ============================================
              Body: Translation text
              Blur-reveal with staggered timing
              ============================================ */}
          <div className="space-y-3">
            <p 
              dir={translationDirection}
              className={`
                text-lg font-light leading-relaxed
                text-neutral-200
                selection:bg-white/20 selection:text-white
                ${translationDirection === 'rtl' ? 'text-right' : 'text-left'}
              `}
              style={{
                WebkitFontSmoothing: 'antialiased',
                MozOsxFontSmoothing: 'grayscale',
                textRendering: 'optimizeLegibility',
              }}
            >
              {item.translation}
            </p>
          </div>
          
          {/* ============================================
              Collapsible Original Text
              Grid-based height animation for smoothness
              ============================================ */}
          <div 
            className="
              grid transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
            "
            style={{
              gridTemplateRows: showOriginal ? '1fr' : '0fr',
            }}
          >
            <div className="overflow-hidden">
              <div 
                className={`
                  mt-6 pt-5 
                  border-t border-dashed border-white/[0.08]
                  transition-opacity duration-500
                  ${showOriginal ? 'opacity-100' : 'opacity-0'}
                `}
              >
                <div className="flex justify-between items-start gap-4">
                  <p 
                    dir={originalDirection}
                    className={`
                      text-sm text-neutral-500 
                      font-light leading-relaxed 
                      italic
                      flex-1
                      ${originalDirection === 'rtl' ? 'text-right' : 'text-left'}
                    `}
                    style={{
                      WebkitFontSmoothing: 'antialiased',
                    }}
                  >
                    "{item.original}"
                  </p>
                  <button
                    onClick={() => handleSpeak(item.original, item.sourceLang)}
                    className="
                      p-1.5 rounded-full shrink-0
                      text-neutral-600 
                      hover:text-neutral-400 
                      hover:bg-white/[0.03]
                      transition-all duration-300
                    "
                    title="Listen Original"
                  >
                    <Volume2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default TranslationItem;
