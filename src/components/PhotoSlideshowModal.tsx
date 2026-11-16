import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Music,
  Volume2,
  VolumeX,
  ArrowLeft,
  Eye,
  EyeOff,
  Clock,
} from 'lucide-react';
import type { SlideIntervalSec, SlideTransitionMode, UsbMediaFile } from '../types/media';
import { SLIDE_TRANSITIONS, stepSlideIndex } from '../utils/usbMedia';

interface PhotoSlideshowModalProps {
  showAudio?: boolean;
  photos: UsbMediaFile[];
  initialPhotoIndex: number;
  transitionMode: SlideTransitionMode;
  onChangeTransition: (mode: SlideTransitionMode) => void;
  intervalSec: SlideIntervalSec;
  onChangeInterval: (sec: SlideIntervalSec) => void;
  activeTrack: UsbMediaFile | null;
  isAudioPlaying: boolean;
  isAudioMuted: boolean;
  onToggleAudioPlay: () => void;
  onNextAudio: () => void;
  onToggleAudioMute: () => void;
  onClose: () => void;
}

const INTERVAL_OPTIONS: SlideIntervalSec[] = [3, 5, 8, 12];

export const PhotoSlideshowModal: React.FC<PhotoSlideshowModalProps> = ({
  photos,
  initialPhotoIndex,
  transitionMode,
  onChangeTransition,
  intervalSec,
  onChangeInterval,
  activeTrack,
  isAudioPlaying,
  isAudioMuted,
  onToggleAudioPlay,
  onNextAudio,
  onToggleAudioMute,
  onClose,
  showAudio = false,
}) => {
  const [photoIndex, setPhotoIndex] = useState(initialPhotoIndex);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isSlideshowPlaying, setIsSlideshowPlaying] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [tick, setTick] = useState(0); // cambia en cada navegación manual: reinicia el temporizador
  const deckRef = useRef<HTMLDivElement | null>(null);

  const manualStep = (dir: 1 | -1) => {
    setDirection(dir);
    setPhotoIndex((prev) => stepSlideIndex(prev, photos.length, dir === 1 ? 'next' : 'prev'));
    setTick((t) => t + 1);
  };

  const currentPhoto = photos[photoIndex] ?? photos[0];

  // Auto-advance slideshow timer
  useEffect(() => {
    if (!isSlideshowPlaying || photos.length <= 1) return;
    const timer = window.setInterval(() => {
      setDirection(1);
      setPhotoIndex((prev) => stepSlideIndex(prev, photos.length, 'next'));
    }, intervalSec * 1000);
    return () => window.clearInterval(timer);
  }, [isSlideshowPlaying, intervalSec, photos.length, tick]);

  // Control remoto: con el foco en el panel, las flechas recorren sus botones; sin foco, izquierda/derecha cambian de foto.
  useEffect(() => {
    const moveInDeck = (dir: 'up' | 'down' | 'left' | 'right'): boolean => {
      const root = document.querySelector<HTMLElement>('[data-fullscreen-modal]');
      if (!root) return false;
      // Todos los botones visibles de la presentación: fila superior (Volver, música, OSD) y panel inferior.
      const btns = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).filter(
        (b) => !b.disabled && b.getClientRects().length > 0 && getComputedStyle(b).visibility !== 'hidden' && !b.closest('.opacity-0')
      );
      if (btns.length === 0) return false;
      const active = document.activeElement as HTMLButtonElement | null;
      if (!active || !btns.includes(active)) {
        btns[0].focus();
        return true;
      }
      const r0 = active.getBoundingClientRect();
      const ax = r0.left + r0.width / 2;
      const ay = r0.top + r0.height / 2;
      let best: HTMLElement | null = null;
      let bestScore = Infinity;
      for (const b of btns) {
        if (b === active) continue;
        const r = b.getBoundingClientRect();
        const dx = r.left + r.width / 2 - ax;
        const dy = r.top + r.height / 2 - ay;
        const ok = dir === 'up' ? dy < -4 : dir === 'down' ? dy > 4 : dir === 'left' ? dx < -4 : dx > 4;
        if (!ok) continue;
        const primary = dir === 'up' || dir === 'down' ? Math.abs(dy) : Math.abs(dx);
        const secondary = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
        const score = primary + secondary * 2;
        if (score < bestScore) {
          bestScore = score;
          best = b;
        }
      }
      if (best) {
        best.focus();
        best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        return true;
      }
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        onClose();
        return;
      }
      const active = document.activeElement as HTMLElement | null;
      const onButton = Boolean(active?.closest('[data-fullscreen-modal] button'));
      const arrowDir: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      };
      if (onButton && e.key in arrowDir) {
        // Con foco en un botón, las flechas recorren todos los botones de la presentación.
        if (moveInDeck(arrowDir[e.key])) e.preventDefault();
        return;
      }
      if (onButton) return; // Enter/espacio: el botón enfocado se activa de forma nativa
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // Sin foco: Arriba entra a la fila superior, Abajo al panel inferior.
        const zone = e.key === 'ArrowDown' ? '[data-slide-deck] button' : '[data-fullscreen-modal] button';
        const first = document.querySelector<HTMLElement>(zone);
        if (first) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        manualStep(e.key === 'ArrowRight' ? 1 : -1);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        setIsSlideshowPlaying((p) => !p);
      } else if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setShowControls((s) => !s);
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        onToggleAudioPlay();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, photos.length, onToggleAudioPlay]);

  if (!currentPhoto) return null;

  const photoSrc = currentPhoto.objectUrl || currentPhoto.thumbnailUrl || '';

  // Compute Framer Motion animation variants per selected transition mode
  const getMotionProps = () => {
    switch (transitionMode) {
      case 'none':
        return {
          initial: { opacity: 1 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.01 },
        };
      case 'slide':
        return {
          initial: { x: direction > 0 ? '100%' : '-100%', opacity: 0.4 },
          animate: { x: '0%', opacity: 1 },
          exit: { x: direction > 0 ? '-100%' : '100%', opacity: 0.4 },
          transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] as const },
        };
      case 'ken-burns':
        return {
          initial: { opacity: 0, scale: 1.0 },
          animate: { opacity: 1, scale: 1.08 },
          exit: { opacity: 0, scale: 1.12 },
          transition: {
            opacity: { duration: 0.9 },
            scale: { duration: intervalSec + 1, ease: 'linear' as const },
          },
        };
      case 'blur':
        return {
          initial: { opacity: 0, filter: 'blur(20px)', scale: 1.03 },
          animate: { opacity: 1, filter: 'blur(0px)', scale: 1 },
          exit: { opacity: 0, filter: 'blur(20px)', scale: 0.98 },
          transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1] as const },
        };
      case 'zoom':
        return {
          initial: { opacity: 0, scale: 0.88 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 1.12 },
          transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
        };
      case 'fade':
      default:
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.85, ease: 'easeInOut' as const },
        };
    }
  };

  const motionProps = getMotionProps();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Presentación de fotografías con música"
      data-fullscreen-modal=""
      data-transition-mode={transitionMode}
      className="fixed inset-0 z-50 bg-[#05080F] overflow-hidden flex flex-col justify-between select-none"
    >
      {/* Ambient Blurred Background from Current Photo */}
      <img
        src={photoSrc}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-30 scale-110 pointer-events-none"
      />

      {/* Active Photo Stage with Selectable Transitions */}
      <div className="absolute inset-0 flex items-center justify-center p-4 lg:p-8 pointer-events-none">
        <AnimatePresence mode="sync">
          <motion.img
            key={`${currentPhoto.id}-${transitionMode}-${photoIndex}`}
            src={photoSrc}
            alt={currentPhoto.name}
            referrerPolicy="no-referrer"
            initial={motionProps.initial}
            animate={motionProps.animate}
            exit={motionProps.exit}
            transition={motionProps.transition}
            className="absolute max-w-[94vw] max-h-[86vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
          />
        </AnimatePresence>
      </div>

      {/* Top Bar: Back + Photo Counter + Simultaneous Audio Status + Toggle Controls */}
      <div
        className={`relative z-20 flex flex-wrap items-center justify-between gap-4 px-8 lg:px-14 pt-6 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onClose}
            className="tv-focus-button flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-[#121826]/85 backdrop-blur-md border-2 border-white/15 hover:border-[#00D2FF] text-[#F8FAFC] font-display text-base font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver</span>
          </button>

          <div className="px-4 py-2 rounded-full bg-[#121826]/80 backdrop-blur-md border border-white/10">
            <span className="font-display text-base font-bold text-[#F8FAFC] tabular-nums">
              {photoIndex + 1} / {photos.length}
            </span>
            <span className="mx-2 text-[#475569]">·</span>
            <span className="text-base text-[#BBC9CF]">{currentPhoto.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Simultaneous Background Music Controls */}
          {showAudio && activeTrack && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#121826]/85 backdrop-blur-md border border-[#6366F1]/50">
              <Music className={`w-4 h-4 ${isAudioPlaying ? 'text-[#00D2FF]' : 'text-[#94A3B8]'}`} />
              <span className="font-display text-sm font-semibold text-[#F8FAFC] max-w-[200px] truncate">
                {activeTrack.name}
              </span>
              <button
                type="button"
                aria-label={isAudioPlaying ? 'Pausar música de fondo' : 'Reproducir música de fondo'}
                onClick={onToggleAudioPlay}
                className="w-8 h-8 rounded-full bg-[#00D2FF] text-[#0B0F19] flex items-center justify-center cursor-pointer ml-1"
              >
                {isAudioPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>
              <button
                type="button"
                aria-label="Siguiente canción"
                onClick={onNextAudio}
                className="w-8 h-8 rounded-full bg-[#1C2336] text-[#F8FAFC] hover:text-[#00D2FF] flex items-center justify-center cursor-pointer"
              >
                <SkipForward className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label={isAudioMuted ? 'Activar sonido de fondo' : 'Silenciar música de fondo'}
                onClick={onToggleAudioMute}
                className="w-8 h-8 rounded-full bg-[#1C2336] text-[#94A3B8] hover:text-[#F8FAFC] flex items-center justify-center cursor-pointer"
              >
                {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          )}

          <button
            type="button"
            aria-label="Ocultar controles"
            onClick={() => setShowControls(false)}
            className="tv-focus-button flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#121826]/85 border border-white/15 hover:border-[#00D2FF] text-[#F8FAFC] text-sm font-semibold cursor-pointer"
          >
            <EyeOff className="w-4 h-4" />
            <span>Ocultar OSD</span>
          </button>
        </div>
      </div>

      {/* Floating Show OSD button when hidden */}
      {!showControls && (
        <button
          type="button"
          onClick={() => setShowControls(true)}
          aria-label="Mostrar controles"
          className="fixed top-6 right-8 z-30 flex items-center gap-2 px-4 py-2 rounded-full bg-[#121826]/70 border border-white/15 text-sm font-semibold text-[#F8FAFC] cursor-pointer"
        >
          <Eye className="w-4 h-4" />
          <span>Mostrar controles</span>
        </button>
      )}

      {/* Bottom Deck: Slideshow Controls + Transition Modes + Interval */}
      <div
        ref={deckRef}
        data-slide-deck=""
        className={`relative z-20 mx-8 lg:mx-14 mb-6 rounded-xl bg-[#121826]/88 backdrop-blur-xl border border-white/10 p-5 flex flex-col gap-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none invisible'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Photo Transport */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Foto anterior"
              onClick={() => manualStep(-1)}
              className="tv-focus-button w-11 h-11 rounded-full bg-[#1C2336] border border-white/15 hover:border-[#00D2FF] text-[#F8FAFC] flex items-center justify-center cursor-pointer"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              type="button"
              aria-label={isSlideshowPlaying ? 'Pausar presentación' : 'Reanudar presentación'}
              onClick={() => setIsSlideshowPlaying((p) => !p)}
              className="tv-focus-button flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-[#00D2FF] hover:bg-[#FFFFFF] text-[#0B0F19] font-display text-base font-bold cursor-pointer"
            >
              {isSlideshowPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current" />
              )}
              <span>{isSlideshowPlaying ? 'Pausar fotos' : 'Reanudar fotos'}</span>
            </button>

            <button
              type="button"
              aria-label="Siguiente foto"
              onClick={() => manualStep(1)}
              className="tv-focus-button w-11 h-11 rounded-full bg-[#1C2336] border border-white/15 hover:border-[#00D2FF] text-[#F8FAFC] flex items-center justify-center cursor-pointer"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          {/* Interval Selector */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#94A3B8] mr-1" />
            <span className="text-sm font-semibold text-[#94A3B8] mr-1">Intervalo:</span>
            {INTERVAL_OPTIONS.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => onChangeInterval(sec)}
                className={`px-3.5 py-1.5 rounded-lg font-display text-sm font-bold tabular-nums cursor-pointer border transition-colors ${
                  intervalSec === sec
                    ? 'bg-[#6366F1] text-[#F8FAFC] border-[#C0C1FF]'
                    : 'bg-[#1C2336] text-[#94A3B8] border-white/10 hover:text-[#F8FAFC]'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>

        {/* Image Transition Selector Row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-white/10">
          <span className="font-display text-sm font-semibold text-[#BBC9CF] mr-2">
            Transición de imágenes:
          </span>
          {SLIDE_TRANSITIONS.map((option) => {
            const active = transitionMode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChangeTransition(option.id)}
                className={`tv-focus-button px-4 py-2 rounded-lg font-display text-sm font-semibold cursor-pointer border-2 transition-colors ${
                  active
                    ? 'bg-[#00D2FF] text-[#0B0F19] border-[#FFFFFF]'
                    : 'bg-[#1C2336] text-[#F8FAFC] border-white/10 hover:border-[#00D2FF]/70'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
