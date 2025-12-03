import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className = '', 
  hoverEffect = false 
}) => {
  return (
    <div 
      className={`
        relative overflow-hidden
        bg-neutral-900/40 
        backdrop-blur-xl 
        border border-white/5 
        shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]
        rounded-2xl
        transition-all duration-500 ease-out
        ${hoverEffect ? 'hover:bg-neutral-800/50 hover:border-white/10 hover:shadow-[0_8px_40px_0_rgba(0,0,0,0.45)] hover:-translate-y-[2px]' : ''}
        ${className}
      `}
    >
      {/* Subtle shine effect from top left */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent pointer-events-none opacity-50" />
      
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};
