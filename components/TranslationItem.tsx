import React, { useState } from 'react';
import { Copy, Check, Eye, EyeOff, Volume2, Trash2, StopCircle } from 'lucide-react';
import { TranslationRecord } from '../types';
import { GlassCard } from './GlassCard';

interface TranslationItemProps {
  item: TranslationRecord;
  onDelete: (id: string) => void;
}

export const TranslationItem: React.FC<TranslationItemProps> = ({ item, onDelete }) => {
  const [copied, setCopied] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleCopy = async () => {
    try {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(item.translation);
      } else {
        // Fallback for http/local files where Clipboard API is unavailable
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

  const handleSpeak = (text: string, lang: 'pt' | 'en') => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    // Map 'pt'/'en' to specific locale codes if needed
    utterance.lang = lang === 'pt' ? 'pt-BR' : 'en-US';
    
    // Executive tone settings
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1.0;

    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    setIsPlaying(true);
    window.speechSynthesis.speak(utterance);
  };

  const formattedTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).format(new Date(item.timestamp));

  return (
    <GlassCard className="group mb-4 animate-slide-up" hoverEffect={true}>
      <div className="p-6">
        {/* Header: Meta info & Actions */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold tracking-[0.2em] text-neutral-500 uppercase border border-white/10 px-2 py-1 rounded-md">
              {item.sourceLang === 'pt' ? 'PT → EN' : 'EN → PT'}
            </span>
            <span className="text-[10px] text-neutral-600 font-medium tracking-wide">
              {formattedTime}
            </span>
          </div>
          
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-x-2 group-hover:translate-x-0">
             <button
              onClick={() => handleSpeak(item.translation, item.targetLang)}
              className={`p-2 rounded-full transition-all duration-300 ${isPlaying ? 'text-white bg-white/10 animate-pulse' : 'text-neutral-500 hover:text-white hover:bg-white/5'}`}
              title="Listen"
            >
              {isPlaying ? <StopCircle size={14} /> : <Volume2 size={14} />}
            </button>
             <button
              onClick={() => setShowOriginal(!showOriginal)}
              className="p-2 rounded-full hover:bg-white/5 text-neutral-500 hover:text-white transition-colors"
              title={showOriginal ? "Hide Original" : "Show Original"}
            >
              {showOriginal ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button
              onClick={handleCopy}
              className="p-2 rounded-full hover:bg-white/5 text-neutral-500 hover:text-white transition-colors"
              title="Copy"
            >
              {copied ? <Check size={14} className="text-white" /> : <Copy size={14} />}
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="p-2 rounded-full hover:bg-red-500/10 text-neutral-600 hover:text-red-400 transition-colors ml-1"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <p className="text-lg font-light text-neutral-100 leading-relaxed font-sans selection:bg-white/30">
            {item.translation}
          </p>
          
          {/* Collapsible Original Text */}
          <div 
            className={`
              overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
              ${showOriginal ? 'max-h-60 opacity-100 mt-6 pt-5 border-t border-dashed border-white/10' : 'max-h-0 opacity-0'}
            `}
          >
            <div className="flex justify-between items-start">
               <p className="text-sm text-neutral-400 font-light leading-relaxed italic pr-8">
                "{item.original}"
              </p>
               <button
                onClick={() => handleSpeak(item.original, item.sourceLang as 'pt'|'en')}
                className="text-neutral-600 hover:text-neutral-300 transition-colors shrink-0 pt-1"
                title="Listen Original"
              >
                <Volume2 size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};
