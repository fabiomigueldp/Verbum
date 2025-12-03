import React, { useState } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { CustomTone } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface CustomToneModalProps {
  onSave: (tone: CustomTone) => void;
  onBack: () => void;
  onClose: () => void;
}

export const CustomToneModal: React.FC<CustomToneModalProps> = ({ onSave, onBack, onClose }) => {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = () => {
    if (!label.trim() || !description.trim()) return;
    
    const newTone: CustomTone = {
      id: uuidv4(),
      label: label.trim(),
      description: description.trim()
    };
    
    onSave(newTone);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity duration-500"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <GlassCard className="w-full max-w-md relative animate-slide-up bg-neutral-900/90" hoverEffect={false}>
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <button 
              onClick={onBack}
              className="text-neutral-500 hover:text-white transition-colors flex items-center gap-2 group"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              <span className="text-xs uppercase tracking-widest">Back</span>
            </button>
            <button 
              onClick={onClose}
              className="text-neutral-500 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <h3 className="text-lg font-light text-white mb-1">Create Custom Tone</h3>
          <p className="text-xs text-neutral-500 mb-8 font-light">Define how the AI should refine your text.</p>

          <div className="space-y-6">
            <div className="group">
              <label className="block text-[10px] uppercase tracking-[0.2em] text-neutral-500 mb-2 group-focus-within:text-white transition-colors">
                Label Name
              </label>
              <input 
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Pirate Mode, Legal Contract"
                className="w-full bg-transparent border-b border-neutral-800 text-white pb-2 focus:border-white focus:outline-none transition-colors placeholder-neutral-800 font-light"
                autoFocus
              />
            </div>

            <div className="group">
              <label className="block text-[10px] uppercase tracking-[0.2em] text-neutral-500 mb-2 group-focus-within:text-white transition-colors">
                Instructions
              </label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe exactly how the text should be rewritten..."
                className="w-full h-32 bg-neutral-900/50 rounded-lg p-3 text-sm text-neutral-300 border border-neutral-800 focus:border-white/30 focus:outline-none transition-all resize-none placeholder-neutral-800 leading-relaxed custom-scrollbar"
              />
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSave}
              disabled={!label.trim() || !description.trim()}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium tracking-wide transition-all duration-300
                ${(!label.trim() || !description.trim())
                  ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                  : 'bg-white text-black hover:bg-neutral-200 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]'}
              `}
            >
              <Check size={16} />
              Save Tone
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};