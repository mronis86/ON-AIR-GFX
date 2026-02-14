// Shared animation utilities for preview and output pages
import type { CSSProperties } from 'react';

export type AnimationType = 'fade' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'scale';

const MIN_TRANSITION_ON_DELAY_MS = 50;

/** Run after delay (min 50ms), then after three rAFs so the "hidden" state is painted, then callback next frame. Use for transition-in. */
export function afterDelayThenPaint(delayMs: number, callback: () => void): void {
  const delay = Math.max(MIN_TRANSITION_ON_DELAY_MS, delayMs);
  setTimeout(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => requestAnimationFrame(callback));
      });
    });
  }, delay);
}

/** Class name for transition-in: uses keyframe animation so "from" state is explicit (no prior paint needed). */
export const getTransitionInClass = (animationType: AnimationType): string => {
  const map: Record<AnimationType, string> = {
    fade: 'transition-in-fade',
    slideUp: 'transition-in-slide-up',
    slideDown: 'transition-in-slide-down',
    slideLeft: 'transition-in-slide-left',
    slideRight: 'transition-in-slide-right',
    scale: 'transition-in-scale',
  };
  return map[animationType] ?? 'transition-in-fade';
};

/** Inline style for animation OUT state. Use this so transform is not purged by Tailwind (dynamic classes).
 *  For slide/scale we only set transform (no opacity) so the content stays visible while it moves off-screen;
 *  otherwise opacity would fade first and the slide would be invisible. */
export const getAnimationOutStyle = (animationType: AnimationType): CSSProperties => {
  switch (animationType) {
    case 'fade':
      return { opacity: 0, pointerEvents: 'none' };
    case 'slideUp':
      return { transform: 'translateY(100%)', pointerEvents: 'none' };
    case 'slideDown':
      return { transform: 'translateY(-100%)', pointerEvents: 'none' };
    case 'slideLeft':
      return { transform: 'translateX(-100%)', pointerEvents: 'none' };
    case 'slideRight':
      return { transform: 'translateX(100%)', pointerEvents: 'none' };
    case 'scale':
      return { transform: 'scale(0.95)', pointerEvents: 'none' };
    default:
      return { opacity: 0, pointerEvents: 'none' };
  }
};

export const getAnimationClasses = (
  isVisible: boolean,
  animationType: AnimationType
): string => {
  if (!isVisible) {
    // Animation out (classes may be purged if only used dynamically; prefer getAnimationOutStyle for output)
    switch (animationType) {
      case 'fade':
        return 'opacity-0 pointer-events-none';
      case 'slideUp':
        return 'opacity-0 translate-y-full pointer-events-none';
      case 'slideDown':
        return 'opacity-0 -translate-y-full pointer-events-none';
      case 'slideLeft':
        return 'opacity-0 -translate-x-full pointer-events-none';
      case 'slideRight':
        return 'opacity-0 translate-x-full pointer-events-none';
      case 'scale':
        return 'opacity-0 scale-95 pointer-events-none';
      default:
        return 'opacity-0 pointer-events-none';
    }
  } else {
    // Animation in
    switch (animationType) {
      case 'fade':
        return 'opacity-100';
      case 'slideUp':
        return 'opacity-100 translate-y-0';
      case 'slideDown':
        return 'opacity-100 translate-y-0';
      case 'slideLeft':
        return 'opacity-100 translate-x-0';
      case 'slideRight':
        return 'opacity-100 translate-x-0';
      case 'scale':
        return 'opacity-100 scale-100';
      default:
        return 'opacity-100';
    }
  }
};

// Animation settings stored in localStorage
export interface AnimationSettings {
  animationInType: AnimationType;
  animationOutType: AnimationType;
  backgroundAnimateFirst: boolean;
  /** Global delay (ms) before content transition-in for polls and Q&A — ensures data is loaded and hidden frame is painted. */
  qaAnimateInDelayMs: number;
}

const DEFAULT_ANIMATION_SETTINGS: AnimationSettings = {
  animationInType: 'fade',
  animationOutType: 'fade',
  backgroundAnimateFirst: false,
  qaAnimateInDelayMs: 100,
};

export const getAnimationSettings = (): AnimationSettings => {
  try {
    const stored = localStorage.getItem('animationSettings');
    if (stored) {
      return { ...DEFAULT_ANIMATION_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (err) {
    console.error('Error loading animation settings:', err);
  }
  return DEFAULT_ANIMATION_SETTINGS;
};

export const saveAnimationSettings = (settings: AnimationSettings): void => {
  try {
    localStorage.setItem('animationSettings', JSON.stringify(settings));
  } catch (err) {
    console.error('Error saving animation settings:', err);
  }
};




