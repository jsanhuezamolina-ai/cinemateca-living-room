import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, ArrowLeft, SkipBack, SkipForward } from 'lucide-react';
import type { UsbMediaFile } from '../types/media';
import { formatTimecode } from '../utils/usbMedia';

interface VideoPlayerModalProps {
  file: UsbMediaFile;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  position?: string;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ file, onClose, onPrev, onNext, position }) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(file.durationSec ?? 160);
  const [showOsd, setShowOsd] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const osdTimerRef = useRef<number | null>(null);

  const bumpOsd = () => {
    setShowOsd(true);
    if (osdTimerRef.current) window.clearTimeout(osdTimerRef.current);
    osdTimerRef.current = window.setTimeout(() => setShowOsd(false), 4000);
  };

  useEffect(() => {
    bumpOsd();
    return () => {
      if (osdTimerRef.current) window.clearTimeout(osdTimerRef.current);
    };
  }, []);

  // Timer for demo videos without a real objectUrl
  useEffect(() => {
    if (file.objectUrl || !isPlaying) return;
    const timer = window.setInterval(() => {
      setCurrentSec((prev) => {
        if (prev + 1 >= durationSec) {
          setIsPlaying(false);
          return durationSec;
        }
        return prev + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [file.objectUrl, isPlaying, durationSec]);

  // Subtle ambient motion layer for sample USB videos
  useEffect(() => {
    if (file.objectUrl) return;
    let rafId = 0;
    let t = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (isPlaying) t += 0.015;
          const { width, height } = canvas;
          ctx.clearRect(0, 0, width, height);
          const grad = ctx.createRadialGradient(
            width * (0.5 + 0.12 * Math.sin(t)),
            height * (0.45 + 0.08 * Math.cos(t * 0.7)),
            40,
            width * 0.5,
            height * 0.5,
            width * 0.75
          );
          grad.addColorStop(0, `${file.ambientColor}44`);
          grad.addColorStop(1, '#080B11');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);
        }
      }
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [file.objectUrl, file.ambientColor, isPlaying]);

  useEffect(() => {
    const moveAmongButtons = (dir: 'up' | 'down' | 'left' | 'right') => {
      const root = document.querySelector<HTMLElement>('[data-video-modal]');
      if (!root) return false;
      const btns = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).filter(
        (b) => !b.disabled && b.getClientRects().length > 0
      );
      const active = document.activeElement as HTMLElement | null;
      if (!active || !btns.includes(active as HTMLButtonElement)) {
        (dir === 'up' || dir === 'left' ? btns[btns.length - 1] : btns[0])?.focus();
        return true;
      }
      const r0 = active.getBoundingClientRect();
      let best: HTMLElement | null = null;
      let bestScore = Infinity;
      for (const b of btns) {
        if (b === active) continue;
        const r = b.getBoundingClientRect();
        const dx = r.left + r.width / 2 - (r0.left + r0.width / 2);
        const dy = r.top + r.height / 2 - (r0.top + r0.height / 2);
        const ok = dir === 'up' ? dy < -4 : dir === 'down' ? dy > 4 : dir === 'left' ? dx < -4 : dx > 4;
        if (!ok) continue;
        const primary = dir === 'up' || dir === 'down' ? Math.abs(dy) : Math.abs(dx);
        const secondary = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
        const score = primary + secondary * 2;
        if (score < bestScore) { bestScore = score; best = b; }
      }
      if (best) { best.focus(); best.scrollIntoView({ block: 'nearest', inline: 'nearest' }); return true; }
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      bumpOsd();
      const active = document.activeElement as HTMLElement | null;
      const onButton = Boolean(active?.closest('[data-video-modal] button'));
      const arrows: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
      if (onButton) {
        if (e.key in arrows) {
          if (moveAmongButtons(arrows[e.key])) e.preventDefault();
          return;
        }
        if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); onClose(); return; }
        return; // Enter/espacio: el botón enfocado se activa de forma nativa
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        moveAmongButtons(e.key === 'ArrowUp' ? 'up' : 'down');
        return;
      }
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        onClose();
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setIsPlaying((prev) => {
          const next = !prev;
          if (videoRef.current) {
            if (next) videoRef.current.play().catch(() => {});
            else videoRef.current.pause();
          }
          return next;
        });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const nextSec = Math.max(0, currentSec - 10);
        setCurrentSec(nextSec);
        if (videoRef.current) videoRef.current.currentTime = nextSec;
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextSec = Math.min(durationSec, currentSec + 10);
        setCurrentSec(nextSec);
        if (videoRef.current) videoRef.current.currentTime = nextSec;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentSec, durationSec, onClose]);

  const progressPct = durationSec > 0 ? Math.min(100, (currentSec / durationSec) * 100) : 0;

  return (
    <div
data-video-modal=""       role="dialog"
      aria-modal="true"
      aria-label={`Reproduciendo video ${file.name}`}
      onMouseMove={bumpOsd}
      className="fixed inset-0 z-50 bg-[#05080F] flex flex-col justify-between select-none"
    >
      {file.objectUrl ? (
        <video
          ref={videoRef}
          src={file.objectUrl}
          autoPlay
          muted={isMuted}
          onEnded={() => onNext?.()}
          onLoadedMetadata={(e) => {
            if (Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0) {
              setDurationSec(Math.floor(e.currentTarget.duration));
            }
          }}
          onTimeUpdate={(e) => setCurrentSec(Math.floor(e.currentTarget.currentTime))}
          className="absolute inset-0 w-full h-full object-contain bg-black"
        />
      ) : (
        <div className="absolute inset-0 overflow-hidden">
          {file.thumbnailUrl && (
            <img
              src={file.thumbnailUrl}
              alt={file.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-75"
            />
          )}
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            className="absolute inset-0 w-full h-full mix-blend-screen pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080B11] via-transparent to-[#080B11]/60" />
        </div>
      )}

      {/* Top OSD */}
      <div
        className={`relative z-20 flex items-center justify-between px-8 lg:px-14 pt-7 transition-opacity duration-300 ${
          showOsd ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className="tv-focus-button flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-[#121826]/85 border-2 border-white/15 hover:border-[#00D2FF] text-[#F8FAFC] font-display text-base font-semibold cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Volver</span>
        </button>

        <div className="text-right">
          <p className="font-display text-2xl font-bold text-[#F8FAFC]">{file.name}</p>
          <p className="text-sm font-semibold text-[#A5E7FF]">
            {file.formatLabel} · {file.sizeLabel}
          </p>
        </div>
      </div>

      {/* Bottom Scrubber & Transport */}
      <div
        className={`relative z-20 mx-8 lg:mx-14 mb-8 rounded-xl bg-[#121826]/85 backdrop-blur-xl border border-white/10 p-5 flex flex-col gap-4 transition-opacity duration-300 ${
          showOsd ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className="relative h-2.5 w-full rounded-full bg-[#1E293B] cursor-pointer"
          onClick={(e) => {
            bumpOsd();
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
            const nextSec = Math.round(ratio * durationSec);
            setCurrentSec(nextSec);
            if (videoRef.current) videoRef.current.currentTime = nextSec;
          }}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#00D2FF] to-[#6366F1]"
            style={{ width: `${progressPct}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#FFFFFF] border-2 border-[#00D2FF] shadow-[0_0_16px_4px_rgba(0,210,255,0.65)]"
            style={{ left: `${progressPct}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Video anterior"
              disabled={!onPrev}
              onClick={() => { bumpOsd(); onPrev?.(); }}
              className="tv-focus-button flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#1C2336] border border-white/15 hover:border-[#00D2FF] text-[#F8FAFC] font-display text-sm font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-default"
            >
              <SkipBack className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <button
              type="button"
              aria-label="Retroceder 10 segundos"
              onClick={() => {
                bumpOsd();
                const next = Math.max(0, currentSec - 10);
                setCurrentSec(next);
                if (videoRef.current) videoRef.current.currentTime = next;
              }}
              className="tv-focus-button flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#1C2336] border border-white/15 hover:border-[#00D2FF] text-[#F8FAFC] font-display text-sm font-semibold cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>-10s</span>
            </button>

            <button
              type="button"
              aria-label={isPlaying ? 'Pausar video' : 'Reproducir video'}
              onClick={() => {
                bumpOsd();
                setIsPlaying((prev) => {
                  const next = !prev;
                  if (videoRef.current) {
                    if (next) videoRef.current.play().catch(() => {});
                    else videoRef.current.pause();
                  }
                  return next;
                });
              }}
              className="tv-focus-button flex items-center gap-2.5 px-6 py-2.5 rounded-full bg-[#00D2FF] hover:bg-[#FFFFFF] text-[#0B0F19] font-display text-base font-bold cursor-pointer"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
            </button>

            <button
              type="button"
              aria-label="Adelantar 10 segundos"
              onClick={() => {
                bumpOsd();
                const next = Math.min(durationSec, currentSec + 10);
                setCurrentSec(next);
                if (videoRef.current) videoRef.current.currentTime = next;
              }}
              className="tv-focus-button flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#1C2336] border border-white/15 hover:border-[#00D2FF] text-[#F8FAFC] font-display text-sm font-semibold cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
              <span>+10s</span>
            </button>

            <button
              type="button"
              aria-label="Video siguiente"
              disabled={!onNext}
              onClick={() => { bumpOsd(); onNext?.(); }}
              className="tv-focus-button flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#1C2336] border border-white/15 hover:border-[#00D2FF] text-[#F8FAFC] font-display text-sm font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-default"
            >
              <span>Siguiente</span>
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label={isMuted ? 'Activar audio' : 'Silenciar audio'}
              onClick={() => {
                const next = !isMuted;
                setIsMuted(next);
                if (videoRef.current) videoRef.current.muted = next;
              }}
              className="tv-focus-button w-10 h-10 rounded-full bg-[#1C2336] border border-white/15 hover:border-[#00D2FF] text-[#F8FAFC] flex items-center justify-center cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <span className="font-display text-lg font-bold text-[#F8FAFC] tabular-nums">
              {formatTimecode(currentSec)} / {formatTimecode(durationSec)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
