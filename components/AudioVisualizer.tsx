import React from 'react';

interface AudioVisualizerProps {
  isListening: boolean;
  volume: number; // 0 to 1
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isListening, volume }) => {
  // If not listening, show a static or hidden state
  // Requirement: "active state should be indicated by the moving waveform"
  // If not listening, maybe we fade out.

  // We'll render 5 bars.
  // We want them to mirror: short-medium-tall-medium-short
  // And animate height based on volume.

  // Multipliers for the waveform shape
  const bars = [0.4, 0.7, 1.0, 0.7, 0.4];

  return (
    <div className={`flex items-center gap-1.5 h-6 transition-opacity duration-300 ${isListening ? 'opacity-100' : 'opacity-0'}`}>
      {bars.map((multiplier, index) => {
        // Calculate height: min 10%, max 100% based on volume
        // We add a tiny bit of random noise or just stick to the multiplier
        // To make it feel "liquid", we can just use the volume strictly but smoothed by CSS

        // Base height when silent (but listening) = 15%
        // Max height = 100%
        // Dynamic part = volume * multiplier

        const effectiveVolume = Math.max(0, Math.min(1, volume));
        const heightPercent = 15 + (effectiveVolume * 100 * multiplier);
        const clampedHeight = Math.min(100, heightPercent);

        return (
          <div
            key={index}
            className="w-1 bg-white rounded-full transition-all duration-75 ease-out"
            style={{
              height: `${clampedHeight}%`,
              opacity: 0.8 + (effectiveVolume * 0.2), // Brighter when loud
            }}
          />
        );
      })}
    </div>
  );
};
