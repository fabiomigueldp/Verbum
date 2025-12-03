import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Easing function: ease-out-expo
 * Creates a decelerating animation that feels natural and "expensive"
 * The number rushes to the target initially then gently settles
 */
const easeOutExpo = (t: number): number => {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
};

/**
 * Easing function: ease-out-cubic
 * Smoother deceleration, good for smaller value changes
 */
const easeOutCubic = (t: number): number => {
  return 1 - Math.pow(1 - t, 3);
};

export type EasingFunction = 'expo' | 'cubic';

interface UseRollingNumberOptions {
  /** Animation duration in milliseconds */
  duration?: number;
  /** Number of decimal places to preserve during animation */
  decimals?: number;
  /** Easing function to use */
  easing?: EasingFunction;
  /** Delay before animation starts (ms) */
  delay?: number;
}

interface UseRollingNumberReturn {
  /** The current animated value */
  displayValue: number;
  /** Whether the animation is currently running */
  isAnimating: boolean;
  /** Formatted string representation */
  formattedValue: string;
}

const easingFunctions: Record<EasingFunction, (t: number) => number> = {
  expo: easeOutExpo,
  cubic: easeOutCubic,
};

export const useRollingNumber = (
  targetValue: number,
  options: UseRollingNumberOptions = {}
): UseRollingNumberReturn => {
  const {
    duration = 800,
    decimals = 0,
    easing = 'expo',
    delay = 0,
  } = options;

  const [displayValue, setDisplayValue] = useState(targetValue);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Refs to avoid stale closures in animation frame callback
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef<number>(targetValue);
  const previousTargetRef = useRef<number>(targetValue);
  const delayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up animation frame and timeout on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
      }
    };
  }, []);

  // Animation loop using requestAnimationFrame for buttery smooth updates
  const animate = useCallback((timestamp: number) => {
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp;
    }

    const elapsed = timestamp - startTimeRef.current;
    const progress = Math.min(elapsed / duration, 1);
    
    // Apply easing function for natural motion
    const easingFn = easingFunctions[easing];
    const easedProgress = easingFn(progress);
    
    // Interpolate between start and target values
    const currentValue = startValueRef.current + 
      (previousTargetRef.current - startValueRef.current) * easedProgress;
    
    // Round to specified decimal places to prevent floating point artifacts
    const roundedValue = Number(currentValue.toFixed(decimals + 2));
    setDisplayValue(roundedValue);

    if (progress < 1) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      // Ensure we land exactly on target value
      setDisplayValue(previousTargetRef.current);
      setIsAnimating(false);
      animationRef.current = null;
      startTimeRef.current = null;
    }
  }, [duration, easing, decimals]);

  // Start animation when target value changes
  useEffect(() => {
    // Skip if value hasn't actually changed
    if (targetValue === previousTargetRef.current) {
      return;
    }

    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (delayTimeoutRef.current) {
      clearTimeout(delayTimeoutRef.current);
    }

    // Store current display value as start point for new animation
    startValueRef.current = displayValue;
    previousTargetRef.current = targetValue;
    startTimeRef.current = null;
    
    const startAnimation = () => {
      setIsAnimating(true);
      animationRef.current = requestAnimationFrame(animate);
    };

    if (delay > 0) {
      delayTimeoutRef.current = setTimeout(startAnimation, delay);
    } else {
      startAnimation();
    }
  }, [targetValue, animate, delay, displayValue]);

  // Format the display value with proper decimal places
  const formattedValue = displayValue.toFixed(decimals);

  return {
    displayValue,
    isAnimating,
    formattedValue,
  };
};

/**
 * Formats a number with locale-aware thousand separators
 * while preserving the specified decimal places
 */
export const formatWithSeparators = (
  value: number,
  decimals: number = 0,
  locale: string = 'en-US'
): string => {
  return value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};
