import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon, Undo02Icon } from '@hugeicons/core-free-icons';

import './FuseButton.css';

export type FuseButtonSize = 'sm' | 'md' | 'lg';
export type FuseButtonPosition = 'outline' | 'bottom' | 'top';
export type FuseButtonCommitMode = 'press' | 'fuseEnd';
export type FuseButtonSettleMode = 'reset' | 'stay';
export type FuseButtonPhase = 'idle' | 'armed' | 'settled';

export interface FuseButtonProps {
  label?: string;
  undoLabel?: string;
  doneLabel?: string;
  icon?: React.ReactNode;
  color?: string;
  background?: string;
  fuseColor?: string;
  size?: FuseButtonSize;
  radius?: number;
  undoWindow?: number;
  fuse?: FuseButtonPosition;
  fuseThickness?: number;
  crossfadeMs?: number;
  commitOn?: FuseButtonCommitMode;
  pauseOnHover?: boolean;
  settle?: FuseButtonSettleMode;
  disabled?: boolean;
  onCommit?: (reason: FuseButtonCommitMode) => void;
  onUndo?: () => void;
  onFuseEnd?: () => void;
  onPhaseChange?: (phase: FuseButtonPhase) => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
  testId?: string;
}

interface FuseAnimationHandle {
  readonly playState: AnimationPlayState;
  readonly currentTime: number;
  setOnFinish(cb: (() => void) | null): void;
  pause(): void;
  play(): void;
  cancel(): void;
}

type FuseCssVars = React.CSSProperties & Record<`--fb-${string}`, string>;

const LINE: Keyframe[] = [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }];
const OUTLINE: Keyframe[] = [{ strokeDashoffset: 0 }, { strokeDashoffset: -1 }];

const SIZES: Record<FuseButtonSize, { height: number; font: number; icon: number; px: number }> = {
  sm: { height: 36, font: 13, icon: 14, px: 16 },
  md: { height: 44, font: 14, icon: 15, px: 20 },
  lg: { height: 52, font: 15, icon: 17, px: 24 },
};

function createTimerFallbackAnimation(duration: number, from: number): FuseAnimationHandle {
  const clampedDuration = Math.max(0, duration);
  let elapsed = Math.max(0, Math.min(clampedDuration, from));
  let startedAt = Date.now();
  let state: AnimationPlayState = 'running';
  let timerId: number | null = null;
  let finishCb: (() => void) | null = null;

  function schedule() {
    if (timerId !== null) {
      window.clearTimeout(timerId);
      timerId = null;
    }
    startedAt = Date.now();
    const remaining = Math.max(0, clampedDuration - elapsed);
    timerId = window.setTimeout(() => {
      timerId = null;
      elapsed = clampedDuration;
      state = 'finished';
      finishCb?.();
    }, remaining);
  }

  const handle: FuseAnimationHandle = {
    get playState() {
      return state;
    },
    get currentTime() {
      if (state === 'running') {
        return Math.min(clampedDuration, elapsed + (Date.now() - startedAt));
      }
      return elapsed;
    },
    setOnFinish(cb) {
      finishCb = cb;
    },
    pause() {
      if (state !== 'running') return;
      elapsed = Math.min(clampedDuration, elapsed + (Date.now() - startedAt));
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
      state = 'paused';
    },
    play() {
      if (state !== 'paused') return;
      state = 'running';
      schedule();
    },
    cancel() {
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
      finishCb = null;
      state = 'idle';
    },
  };

  schedule();
  return handle;
}

function createFuseAnimation(
  el: Element,
  keyframes: Keyframe[],
  duration: number,
  from: number,
): FuseAnimationHandle {
  if (typeof el.animate === 'function') {
    const animation = el.animate(keyframes, {
      duration,
      easing: 'linear',
      fill: 'forwards',
    });
    if (from) {
      animation.currentTime = from;
    }
    return {
      get playState() {
        return animation.playState;
      },
      get currentTime() {
        return Number(animation.currentTime) || 0;
      },
      setOnFinish(cb) {
        animation.onfinish = cb ? () => cb() : null;
      },
      pause: () => animation.pause(),
      play: () => animation.play(),
      cancel: () => animation.cancel(),
    };
  }
  return createTimerFallbackAnimation(duration, from);
}

export default function FuseButton({
  label = 'Recall',
  undoLabel = 'Undo',
  doneLabel = 'Recalled',
  icon,
  color = '#f5f5f5',
  background = '#27272a',
  fuseColor = '#f5a524',
  size = 'md',
  radius = 22,
  undoWindow = 4000,
  fuse = 'outline',
  fuseThickness = 1.5,
  crossfadeMs = 200,
  commitOn = 'press',
  pauseOnHover = true,
  settle = 'reset',
  disabled = false,
  onCommit,
  onUndo,
  onFuseEnd,
  onPhaseChange,
  className = '',
  type = 'button',
  title,
  testId,
}: FuseButtonProps) {
  const [phase, setPhase] = useState<FuseButtonPhase>('idle');
  const [instant, setInstant] = useState(false);

  const rootRef = useRef<HTMLSpanElement | null>(null);
  const idleRef = useRef<HTMLButtonElement | null>(null);
  const undoRef = useRef<HTMLButtonElement | null>(null);
  const lineRef = useRef<HTMLElement | null>(null);
  const rimRef = useRef<SVGRectElement | null>(null);
  const anim = useRef<FuseAnimationHandle | null>(null);
  const pause = useRef({ hover: false, hidden: false, canHoverPause: false });
  const lastInput = useRef<'pointer' | 'keyboard'>('pointer');
  const windowRef = useRef(undoWindow);
  const phaseRef = useRef<FuseButtonPhase>(phase);
  phaseRef.current = phase;

  const latest = useRef({
    onCommit,
    onUndo,
    onFuseEnd,
    onPhaseChange,
    commitOn,
    settle,
  });
  latest.current = { onCommit, onUndo, onFuseEnd, onPhaseChange, commitOn, settle };

  const statusId = useId();
  const preset = SIZES[size] || SIZES.md;

  const go = useCallback((next: FuseButtonPhase) => {
    setInstant(lastInput.current === 'keyboard');
    phaseRef.current = next;
    setPhase(next);
    latest.current.onPhaseChange?.(next);
  }, []);

  const syncPlayState = useCallback(() => {
    const a = anim.current;
    if (!a) return;
    const { hover, hidden } = pause.current;
    if (hover || hidden) {
      if (a.playState === 'running') a.pause();
    } else if (a.playState === 'paused') {
      a.play();
    }
  }, []);

  const light = useCallback(
    (from = 0) => {
      const el = fuse === 'outline' ? rimRef.current : lineRef.current;
      if (!el) return;
      anim.current?.cancel();
      const a = createFuseAnimation(
        el,
        fuse === 'outline' ? OUTLINE : LINE,
        windowRef.current,
        from,
      );
      a.setOnFinish(() => {
        const l = latest.current;
        l.onFuseEnd?.();
        if (l.commitOn === 'fuseEnd') l.onCommit?.('fuseEnd');
        lastInput.current = 'pointer';
        go(l.settle === 'stay' ? 'settled' : 'idle');
      });
      anim.current = a;
      syncPlayState();
    },
    [fuse, go, syncPlayState],
  );

  const arm = () => {
    if (disabled || phase !== 'idle') return;
    windowRef.current = undoWindow;
    light();
    pause.current.canHoverPause = false;
    pause.current.hover = false;
    if (commitOn === 'press') onCommit?.('press');
    go('armed');
  };

  const undo = () => {
    if (phase !== 'armed') return;
    const a = anim.current;
    if (a) {
      a.setOnFinish(null);
      a.pause();
    }
    onUndo?.();
    go('idle');
  };

  useEffect(() => {
    const inside = rootRef.current?.contains(document.activeElement);
    if (phase === 'armed') {
      undoRef.current?.focus({ preventScroll: true });
    } else if (inside) {
      (phase === 'idle' ? idleRef.current : rootRef.current)?.focus({ preventScroll: true });
    }
  }, [phase]);

  useEffect(() => {
    const onVisibility = () => {
      pause.current.hidden = document.hidden;
      syncPlayState();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      anim.current?.cancel();
    };
  }, [syncPlayState]);

  useEffect(() => {
    const a = anim.current;
    if (!a || phaseRef.current !== 'armed') return;
    light(Number(a.currentTime) || 0);
  }, [fuse, light]);

  useEffect(() => {
    if (pauseOnHover) return;
    pause.current.hover = false;
    syncPlayState();
  }, [pauseOnHover, syncPlayState]);

  const handlePointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    lastInput.current = 'pointer';
    const pressable = phase === 'armed' || (phase === 'idle' && !disabled);
    if (e.button === 0 && pressable && rootRef.current) {
      rootRef.current.dataset.pressed = '';
    }
  };

  const release = () => {
    if (rootRef.current) delete rootRef.current.dataset.pressed;
  };

  const handlePointerEnter = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (pauseOnHover && e.pointerType === 'mouse' && pause.current.canHoverPause) {
      pause.current.hover = true;
      syncPlayState();
    }
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLSpanElement>) => {
    release();
    if (e.pointerType !== 'mouse') return;
    pause.current.canHoverPause = true;
    pause.current.hover = false;
    syncPlayState();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Enter' || e.key === ' ') lastInput.current = 'keyboard';
    if (e.key === 'Escape' && phase === 'armed') {
      e.preventDefault();
      lastInput.current = 'keyboard';
      undo();
    }
  };

  const actionIcon = icon ?? (
    <HugeiconsIcon icon={Undo02Icon} size={preset.icon} strokeWidth={1.8} />
  );
  const line = <i ref={lineRef} className="fuse-button__fuse" aria-hidden="true" />;

  const statusAnnouncement =
    phase === 'idle'
      ? ''
      : phase === 'settled' || commitOn === 'press'
        ? doneLabel
        : `${label} armed. Select ${undoLabel} or press Escape to cancel.`;

  const styleVars: FuseCssVars = {
    '--fb-ink': color,
    '--fb-bg': background,
    '--fb-fuse': fuseColor,
    '--fb-fuse-h': `${fuseThickness}px`,
    '--fb-radius': `${radius}px`,
    '--fb-fade': `${crossfadeMs}ms`,
    '--fb-h': `${preset.height}px`,
    '--fb-fs': `${preset.font}px`,
    '--fb-icon': `${preset.icon}px`,
    '--fb-px': `${preset.px}px`,
  };

  return (
    <span
      ref={rootRef}
      tabIndex={-1}
      title={title}
      data-testid={testId}
      className={`fuse-button${className ? ` ${className}` : ''}`}
      data-phase={phase}
      data-fuse={fuse}
      data-instant={instant ? '' : undefined}
      aria-disabled={phase === 'settled' || undefined}
      style={styleVars}
      onPointerDown={handlePointerDown}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={idleRef}
        type={type}
        className="fuse-button__face fuse-button__idle"
        disabled={disabled}
        inert={phase !== 'idle'}
        onClick={arm}
      >
        <span className="fuse-button__icon" aria-hidden="true">
          {actionIcon}
        </span>
        {label}
      </button>
      <button
        ref={undoRef}
        type="button"
        className="fuse-button__face fuse-button__undo"
        aria-describedby={statusId}
        aria-keyshortcuts="Escape"
        inert={phase !== 'armed'}
        onClick={undo}
      >
        <span className="fuse-button__icon fuse-button__icon--undo" aria-hidden="true">
          <HugeiconsIcon icon={Undo02Icon} size={preset.icon} strokeWidth={2} />
        </span>
        {undoLabel}
        {fuse !== 'outline' ? line : null}
      </button>
      <span className="fuse-button__face fuse-button__settled" inert={phase !== 'settled'}>
        <span className="fuse-button__icon" aria-hidden="true">
          <HugeiconsIcon icon={Tick02Icon} size={preset.icon} strokeWidth={2.2} />
        </span>
        {doneLabel}
      </span>
      {fuse === 'outline' ? (
        <svg className="fuse-button__rim" aria-hidden="true">
          <rect ref={rimRef} pathLength={1} />
        </svg>
      ) : null}
      <span className="fuse-button__status" id={statusId} role="status" aria-live="polite">
        {statusAnnouncement}
      </span>
    </span>
  );
}
