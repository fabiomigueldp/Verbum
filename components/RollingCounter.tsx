import React, { useMemo } from 'react';
import { useRollingNumber, formatWithSeparators, EasingFunction } from '../hooks/useRollingNumber';

interface RollingCounterProps {
  /** The target value to animate to */
  value: number;
  /** Number of decimal places to display */
  decimals?: number;
  /** Animation duration in milliseconds */
  duration?: number;
  /** Easing function: 'expo' (default) or 'cubic' */
  easing?: EasingFunction;
  /** Prefix to display before the number (e.g., '$') */
  prefix?: string;
  /** Suffix to display after the number (e.g., '%') */
  suffix?: string;
  /** Whether to use thousand separators */
  useSeparators?: boolean;
  /** Locale for number formatting */
  locale?: string;
  /** Additional CSS classes */
  className?: string;
  /** Delay before animation starts (ms) */
  delay?: number;
}

/**
 * RollingCounter - A premium animated number display component
 * 
 * Features:
 * - Physics-based easing (ease-out-expo) for natural motion
 * - Tabular nums to prevent layout shift during animation
 * - Precise decimal formatting throughout animation frames
 * - Zero external dependencies (uses custom RAF-based hook)
 */
export const RollingCounter: React.FC<RollingCounterProps> = ({
  value,
  decimals = 0,
  duration = 800,
  easing = 'expo',
  prefix = '',
  suffix = '',
  useSeparators = true,
  locale = 'en-US',
  className = '',
  delay = 0,
}) => {
  const { displayValue, isAnimating } = useRollingNumber(value, {
    duration,
    decimals,
    easing,
    delay,
  });

  // Format the number for display
  const formattedDisplay = useMemo(() => {
    if (useSeparators) {
      return formatWithSeparators(displayValue, decimals, locale);
    }
    return displayValue.toFixed(decimals);
  }, [displayValue, decimals, useSeparators, locale]);

  return (
    <span
      className={`
        font-mono
        inline-block
        ${className}
      `}
      style={{
        fontVariantNumeric: 'tabular-nums',
        fontFeatureSettings: '"tnum" 1',
      }}
      data-animating={isAnimating}
    >
      {prefix}{formattedDisplay}{suffix}
    </span>
  );
};

/**
 * Specialized counter for currency display
 * Pre-configured with dollar sign and 5 decimal precision
 */
export const CurrencyCounter: React.FC<Omit<RollingCounterProps, 'prefix' | 'decimals'> & {
  decimals?: number;
}> = ({
  decimals = 5,
  ...props
}) => {
  return (
    <RollingCounter
      {...props}
      prefix="$"
      decimals={decimals}
    />
  );
};

/**
 * Specialized counter for token/integer display
 * Pre-configured with thousand separators and no decimals
 */
export const TokenCounter: React.FC<Omit<RollingCounterProps, 'decimals'>> = (props) => {
  return (
    <RollingCounter
      {...props}
      decimals={0}
      useSeparators={true}
    />
  );
};

export default RollingCounter;
