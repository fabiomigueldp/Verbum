import React from 'react';
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

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      {/* Soft backdrop — interface remains visible behind */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-500"
        onClick={onDismiss}
      />

      <GlassCard
        className="w-full max-w-sm relative animate-slide-up"
        hoverEffect={false}
      >
        <div className="p-8 text-center">
          {/* Subtle icon */}
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.06] mb-6">
            <Sparkles size={18} className="text-neutral-400" />
          </div>

          {/* Title */}
          <h3 className="text-sm font-medium text-white tracking-tight mb-2">
            Configure Model
          </h3>

          {/* Description */}
          <p className="text-[11px] text-neutral-500 leading-relaxed max-w-[240px] mx-auto mb-8">
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
                w-full py-3 px-4 rounded-xl
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
                w-full py-3 px-4 rounded-xl
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


