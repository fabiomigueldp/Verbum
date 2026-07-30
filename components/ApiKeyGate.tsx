import React, { useEffect } from 'react';
import { Settings, Compass, Sparkles } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { getProvider } from '../services/providers';

interface ApiKeyGateProps {
  onOpenSettings: () => void;
  onDismiss: () => void;
  isEnvKeyInvalid?: boolean;
  provider?: string;
}

export const ApiKeyGate: React.FC<ApiKeyGateProps> = ({
  onOpenSettings,
  onDismiss,
  isEnvKeyInvalid,
  provider = 'gemini',
}) => {
  const providerConfig = getProvider(provider);
  const providerName = providerConfig?.name || provider;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-key-gate-title"
      aria-describedby="api-key-gate-description"
    >
      {/* Soft backdrop — interface remains visible behind */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onDismiss}
        aria-hidden="true"
      />

      <GlassCard
        className="w-full max-w-sm relative"
        hoverEffect={false}
      >
        <div className="p-8 text-center">
          {/* Subtle icon */}
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.06] mb-6">
            <Sparkles size={18} className="text-neutral-400" />
          </div>

          {/* Title */}
          <h3 id="api-key-gate-title" className="text-sm font-medium text-white tracking-tight mb-2">
            Configure Model
          </h3>

          {/* Description */}
          <p id="api-key-gate-description" className="text-[11px] text-neutral-500 leading-relaxed max-w-[240px] mx-auto mb-8">
            {isEnvKeyInvalid
              ? `The environment key for ${providerName} is invalid. Please configure a valid key in settings.`
              : `Select a provider and add an API key to enable neural translation.`
            }
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={onOpenSettings}
              className="
                w-full min-h-11 py-3 px-4 rounded-xl
                flex items-center justify-center gap-2
                bg-white text-black
                text-[10px] tracking-[0.2em] uppercase font-bold
                hover:bg-neutral-200
                transition-all duration-300
                shadow-[0_0_30px_rgba(255,255,255,0.1)]
              "
            >
              <Settings size={13} />
              Open Settings
            </button>

            <button
              onClick={onDismiss}
              className="
                w-full min-h-11 py-3 px-4 rounded-xl
                flex items-center justify-center gap-2
                text-[10px] tracking-[0.15em] uppercase
                text-neutral-600 hover:text-neutral-300
                hover:bg-white/[0.03]
                transition-all duration-300
              "
            >
              <Compass size={13} />
              Explore App
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};


