import React, { memo } from 'react';
import { getAllProviders, getProvider, type ProviderConfig } from '../services/providers';
import { Check } from 'lucide-react';

interface ProviderSelectorProps {
  value: string;
  onChange: (providerId: string) => void;
}

export const ProviderSelector = memo<ProviderSelectorProps>(({ value, onChange }) => {
  const providers = getAllProviders();

  return (
    <div className="space-y-1">
      {providers.map((provider) => {
        const isActive = value === provider.id;
        return (
          <button
            key={provider.id}
            onClick={() => onChange(provider.id)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
              text-left transition-all duration-300
              ${isActive
                ? 'bg-white/[0.06] border border-white/[0.1]'
                : 'bg-transparent border border-transparent hover:bg-white/[0.03]'
              }
            `}
          >
            {/* Radio indicator */}
            <div className={`
              w-3.5 h-3.5 rounded-full border transition-all duration-300 flex items-center justify-center
              ${isActive
                ? 'border-white bg-white'
                : 'border-white/20 bg-transparent'
              }
            `}>
              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
            </div>

            {/* Provider name */}
            <span className={`
              text-[12px] font-medium tracking-tight flex-1
              ${isActive ? 'text-white' : 'text-neutral-400'}
            `}>
              {provider.name}
            </span>

            {/* Check mark */}
            {isActive && (
              <Check size={12} className="text-neutral-500" />
            )}
          </button>
        );
      })}
    </div>
  );
});

ProviderSelector.displayName = 'ProviderSelector';
