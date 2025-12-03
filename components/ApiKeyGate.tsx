import React, { useState, useEffect, useRef } from 'react';
import { KeyRound, ExternalLink, Eye, EyeOff, Zap } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface ApiKeyGateProps {
  onSuccess: (apiKey: string) => void;
}

// Gemini API Key regex pattern
export const API_KEY_REGEX = /^AIza[0-9A-Za-z-_]{35}$/;

export const ApiKeyGate: React.FC<ApiKeyGateProps> = ({ onSuccess }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Validate key on change
  useEffect(() => {
    setIsValid(API_KEY_REGEX.test(apiKey));
  }, [apiKey]);

  // Auto-focus input on mount with delay for animation
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const handleInitialize = () => {
    if (!isValid || isUnlocking) return;
    
    setIsUnlocking(true);
    
    // Save to localStorage
    localStorage.setItem('verbum_api_key', apiKey);
    
    // Trigger unlock animation, then callback
    setTimeout(() => {
      onSuccess(apiKey);
    }, 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid) {
      handleInitialize();
    }
  };

  return (
    <div 
      className={`
        fixed inset-0 z-50 flex items-center justify-center p-4
        bg-black/80 backdrop-blur-xl
        transition-all duration-700 ease-out
        ${isUnlocking ? 'opacity-0 scale-110' : 'opacity-100 scale-100'}
      `}
    >
      {/* Ambient glow effect */}
      <div 
        className={`
          absolute inset-0 pointer-events-none
          transition-opacity duration-1000
          ${isValid ? 'opacity-100' : 'opacity-0'}
        `}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-3xl" />
      </div>

      <GlassCard 
        className={`
          w-full max-w-md p-8 
          animate-slide-up
          transition-all duration-500
          ${isUnlocking ? 'scale-105 opacity-0' : 'scale-100 opacity-100'}
        `}
        hoverEffect={false}
      >
        {/* Header Section */}
        <div className="flex flex-col items-center text-center mb-10">
          {/* Animated Key Icon */}
          <div 
            className={`
              relative p-4 mb-6 rounded-2xl
              bg-neutral-900/60 border border-white/5
              transition-all duration-500
              ${isValid ? 'border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.08)]' : ''}
            `}
          >
            <KeyRound 
              size={28} 
              className={`
                text-neutral-400 transition-colors duration-500
                ${isValid ? 'text-white' : ''}
                animate-pulse-slow
              `}
            />
            {/* Valid state indicator ring */}
            <div 
              className={`
                absolute inset-0 rounded-2xl border border-white/30
                transition-all duration-500
                ${isValid ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
              `}
            />
          </div>

          {/* Title & Subtitle */}
          <div className="space-y-3">
            <h1 className="text-[10px] tracking-[0.25em] uppercase text-neutral-400 font-medium">
              VERBUM // NEURAL ENGINE
            </h1>
            <div 
              className={`
                text-[9px] tracking-[0.2em] uppercase font-bold px-3 py-1.5 rounded-full
                transition-all duration-500
                ${isValid 
                  ? 'bg-white/10 text-white border border-white/20' 
                  : 'bg-neutral-900/80 text-neutral-500 border border-white/5'
                }
              `}
            >
              {isValid ? 'CREDENTIALS_VALID' : 'MISSING_CREDENTIALS'}
            </div>
          </div>

          {/* Description */}
          <p className="mt-6 text-[11px] text-neutral-600 leading-relaxed max-w-xs">
            A Gemini API credential is required to initialize the neural refinement context.
          </p>
        </div>

        {/* The "Data Slot" Input */}
        <div className="mb-8">
          <label className="block text-[9px] tracking-[0.2em] uppercase text-neutral-600 mb-3 ml-1">
            API_CREDENTIAL
          </label>
          <div 
            className={`
              relative group
              transition-all duration-500
            `}
          >
            {/* Outer glow container */}
            <div 
              className={`
                absolute -inset-[1px] rounded-xl
                transition-all duration-500
                ${isValid 
                  ? 'bg-gradient-to-r from-white/20 via-white/10 to-white/20 opacity-100' 
                  : isFocused 
                    ? 'bg-white/10 opacity-100' 
                    : 'bg-transparent opacity-0'
                }
              `}
            />
            
            {/* Input container */}
            <div 
              className={`
                relative flex items-center
                bg-black/60 rounded-xl
                border transition-all duration-500
                ${isValid 
                  ? 'border-white/30 shadow-[inset_0_0_20px_rgba(255,255,255,0.03)]' 
                  : isFocused
                    ? 'border-white/15'
                    : 'border-white/5 hover:border-white/10'
                }
              `}
            >
              <input
                ref={inputRef}
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="INSERT_API_KEY_"
                spellCheck={false}
                autoComplete="off"
                className={`
                  w-full px-4 py-4
                  bg-transparent
                  text-sm font-mono tracking-wider
                  text-white placeholder-neutral-700
                  focus:outline-none
                  transition-all duration-300
                `}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              />
              
              {/* Toggle visibility button */}
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className={`
                  p-3 mr-1 rounded-lg
                  text-neutral-600 hover:text-neutral-400
                  hover:bg-white/5
                  transition-all duration-300
                `}
                tabIndex={-1}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Format hint */}
          <p className="mt-3 text-[9px] tracking-wider text-neutral-700 ml-1 font-mono">
            FORMAT: AIza...{apiKey.length > 0 && <span className="text-neutral-500 ml-2">[{apiKey.length}/39]</span>}
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          {/* Primary CTA */}
          <button
            onClick={handleInitialize}
            disabled={!isValid || isUnlocking}
            className={`
              w-full py-4 px-6 rounded-xl
              flex items-center justify-center gap-3
              text-[10px] tracking-[0.2em] uppercase font-bold
              transition-all duration-500
              ${isValid
                ? `bg-white text-black 
                   hover:bg-neutral-200 
                   shadow-[0_0_40px_rgba(255,255,255,0.15)]
                   hover:shadow-[0_0_50px_rgba(255,255,255,0.25)]`
                : 'bg-neutral-900 text-neutral-600 cursor-not-allowed border border-white/5'
              }
              disabled:opacity-50
            `}
          >
            <Zap size={14} className={isUnlocking ? 'animate-pulse' : ''} />
            <span>{isUnlocking ? 'INITIALIZING...' : 'INITIALIZE SYSTEM'}</span>
          </button>

          {/* Secondary: External link */}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="
              flex items-center justify-center gap-2
              py-3 px-4 rounded-xl
              text-[9px] tracking-[0.15em] uppercase
              text-neutral-600 hover:text-neutral-400
              hover:bg-white/5
              transition-all duration-300
              group
            "
          >
            <span>Generate Key</span>
            <ExternalLink size={10} className="opacity-50 group-hover:opacity-100 transition-opacity" />
          </a>
        </div>

        {/* Bottom decorative line */}
        <div className="mt-8 pt-6 border-t border-white/5">
          <div className="flex items-center justify-center gap-2 text-neutral-700">
            <div className="w-1.5 h-1.5 rounded-full bg-neutral-800" />
            <span className="text-[8px] tracking-[0.3em] uppercase">Secure • Local Storage</span>
            <div className="w-1.5 h-1.5 rounded-full bg-neutral-800" />
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
