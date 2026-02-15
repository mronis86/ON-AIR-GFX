// Shared animation utilities for preview and output pages
import type { CSSProperties } from 'react';

export type AnimationType = 'fade' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'scale';

const MIN_TRANSITION_ON_DELAY_MS = 50;

/** CSS animation duration used for transition-in/out keyframes. Keep in sync with style.css. */
export const ANIMATION_DURATION_MS = 500;

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

const SLIDE_SCALE_TYPES: AnimationType[] = ['slideUp', 'slideDown', 'slideLeft', 'slideRight', 'scale'];

/** Class name for transition-in. Slide/scale use fade only when fadeInWithSlide is true. */
export const getTransitionInClass = (
  animationType: AnimationType,
  useHardCut?: boolean,
  fadeInWithSlide: boolean = true
): string => {
  if (useHardCut) return 'transition-in-none';
  if (animationType === 'fade') return 'transition-in-fade';
  if (SLIDE_SCALE_TYPES.includes(animationType)) {
    const withFade: Record<AnimationType, string> = {
      fade: 'transition-in-fade',
      slideUp: 'transition-in-slide-up',
      slideDown: 'transition-in-slide-down',
      slideLeft: 'transition-in-slide-left',
      slideRight: 'transition-in-slide-right',
      scale: 'transition-in-scale',
    };
    const noFade: Record<AnimationType, string> = {
      fade: 'transition-in-fade',
      slideUp: 'transition-in-slide-up-no-fade',
      slideDown: 'transition-in-slide-down-no-fade',
      slideLeft: 'transition-in-slide-left-no-fade',
      slideRight: 'transition-in-slide-right-no-fade',
      scale: 'transition-in-scale-no-fade',
    };
    return fadeInWithSlide ? (withFade[animationType] ?? 'transition-in-fade') : (noFade[animationType] ?? 'transition-in-fade');
  }
  return 'transition-in-fade';
};

/** Class name for transition-out. Slide/scale use fade only when fadeOutWithSlide is true. */
export const getTransitionOutClass = (
  animationType: AnimationType,
  useHardCut?: boolean,
  fadeOutWithSlide: boolean = true
): string => {
  if (useHardCut) return 'transition-out-none';
  if (animationType === 'fade') return 'transition-out-fade';
  if (SLIDE_SCALE_TYPES.includes(animationType)) {
    const withFade: Record<AnimationType, string> = {
      fade: 'transition-out-fade',
      slideUp: 'transition-out-slide-up-fade',
      slideDown: 'transition-out-slide-down-fade',
      slideLeft: 'transition-out-slide-left-fade',
      slideRight: 'transition-out-slide-right-fade',
      scale: 'transition-out-scale-fade',
    };
    const noFade: Record<AnimationType, string> = {
      fade: 'transition-out-fade',
      slideUp: 'transition-out-slide-up',
      slideDown: 'transition-out-slide-down',
      slideLeft: 'transition-out-slide-left',
      slideRight: 'transition-out-slide-right',
      scale: 'transition-out-scale',
    };
    return fadeOutWithSlide ? (withFade[animationType] ?? 'transition-out-fade') : (noFade[animationType] ?? 'transition-out-fade');
  }
  return 'transition-out-fade';
};

/** Inline style for animation OUT state. Use when keyframe classes aren't available (e.g. Tailwind purging).
 *  Prefer getTransitionOutClass for output page. */
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
  /** When true, no in/out animation — content appears and disappears instantly (hard cut). */
  useHardCut: boolean;
  /** When true (default), slide/scale in includes a slight fade. Only applies when Animation In is slide or scale. */
  fadeInWithSlide: boolean;
  /** When true (default), slide/scale out includes a slight fade. Only applies when Animation Out is slide or scale. */
  fadeOutWithSlide: boolean;
  /** Animation In only: show background before content animates in. */
  backgroundAnimateFirst: boolean;
  /** Animation Out only: keep background visible while content animates out (then hide background). */
  contentOutFirst: boolean;
  /** Global delay (ms) before content transition-in for polls and Q&A — ensures data is loaded and hidden frame is painted. */
  qaAnimateInDelayMs: number;
}

const DEFAULT_ANIMATION_SETTINGS: AnimationSettings = {
  animationInType: 'fade',
  animationOutType: 'fade',
  useHardCut: false,
  fadeInWithSlide: true,
  fadeOutWithSlide: true,
  backgroundAnimateFirst: false,
  contentOutFirst: false,
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

export const saveAnimationSettings = (settings: Partial<AnimationSettings>): void => {
  try {
    const current = getAnimationSettings();
    localStorage.setItem('animationSettings', JSON.stringify({ ...current, ...settings }));
  } catch (err) {
    console.error('Error saving animation settings:', err);
  }
};




