import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Volume2,
  VolumeX,
  Music,
} from 'lucide-react';
import type { UsbMediaFile } from '../types/media';
import { audioEngine } from '../utils/audioEngine';
import { formatTimecode } from '../utils/usbMedia';

interface PersistentAudioBarProps {
  track: UsbMediaFile;
  isPlaying: boolean;
  elapsedSec: number;
  shuffle: boolean;
  isMuted: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleShuffle: () => void;
  onToggleMute: () => void;
  onSeek: (nextSec: number) => void;
}

export const PersistentAudioBar: React.FC<PersistentAudioBarProps> = ({
  track,
  isPlaying,
  elapsedSec,
  shuffle,
  isMuted,
  onTogglePlay,
  onPrev,
  onNext,
  onToggleShuffle,
  onToggleMute,
  onSeek,
}) => {
  const [bars, setBars] = useState<number[]>([0.2, 0.35, 0.5, 0.3, 0.6, 0.4, 0.25, 0.45]);
  const [scrubberFocused, setScrubberFocused] = useState(false);

  useEffect(() => {
    let phase = 0;
    const timer = window.setInterval(() => {
      phase += isPlaying ? 0.25 : 0.04;
      setBars(audioEngine.sampleSpectrum(8, isPlaying, phase));
    }, 110);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const totalSec = track.durationSec ?? 240;
  const progressPct = totalSec > 0 ? Math.min(100, (elapsedSec / totalSec) * 100) : 0;

  return (
    <aside
      aria-label="Reproductor de audio USB"
      className="fixed bottom-4 inset-x-8 lg:inset-x-14 z-40 rounded-xl bg-[#121826]/88 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden"
    >
      {/* Interactive 6px Progress Track */}
      <div
        className="relative h-2 w-full bg-[#1E293B] cursor-pointer"
        onMouseEnter={() => setScrubberFocused(true)}
        onMouseLeave={() => setScrubberFocused(false)}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
          onSeek(Math.round(ratio * totalSec));
        }}
      >
        <div
          className="h-full bg-gradient-to-r from-[#00D2FF] to-[#6366F1] transition-[width] duration-150"
          style={{ width: `${progressPct}%` }}
        />
        <div
          aria-hidden="true"
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-[#FFFFFF] border-2 border-[#00D2FF] shadow-[0_0_16px_4px_rgba(0,210,255,0.65)] transition-transform ${
            scrubberFocused ? 'w-4 h-4 scale-100' : 'w-3 h-3 scale-75 opacity-80'
          }`}
          style={{ left: `${progressPct}%` }}
        />
      </div>

      <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Thumbnail + Track Info */}
        <div className="flex items-center gap-4 min-w-0 max-w-xs lg:max-w-sm">
          {track.thumbnailUrl ? (
            <img
              src={track.thumbnailUrl}
              alt={track.name}
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-md object-cover shrink-0 border border-white/15"
            />
          ) : (
            <div className="w-14 h-14 rounded-md bg-[#1C2336] border border-white/15 flex items-center justify-center shrink-0">
              <Music className="w-6 h-6 text-[#00D2FF]" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display text-base lg:text-lg font-bold text-[#F8FAFC] truncate">
              {track.name}
            </p>
            <p className="text-sm text-[#94A3B8] truncate">
              {track.formatLabel} · {track.folderPath}
            </p>
          </div>
        </div>

        {/* Center: Transport Controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Pista anterior"
            onClick={onPrev}
            className="tv-focus-button w-11 h-11 rounded-full bg-[#1C2336] border border-white/10 hover:border-[#00D2FF] text-[#F8FAFC] flex items-center justify-center cursor-pointer"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            type="button"
            aria-label={isPlaying ? 'Pausar audio' : 'Reproducir audio'}
            onClick={onTogglePlay}
            className="tv-focus-button w-12 h-12 rounded-full bg-[#00D2FF] hover:bg-[#FFFFFF] text-[#0B0F19] flex items-center justify-center cursor-pointer shadow-[0_0_18px_rgba(0,210,255,0.4)]"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            aria-label="Pista siguiente"
            onClick={onNext}
            className="tv-focus-button w-11 h-11 rounded-full bg-[#1C2336] border border-white/10 hover:border-[#00D2FF] text-[#F8FAFC] flex items-center justify-center cursor-pointer"
          >
            <SkipForward className="w-5 h-5" />
          </button>

          <button
            type="button"
            aria-label={shuffle ? 'Desactivar reproducción aleatoria' : 'Activar reproducción aleatoria'}
            onClick={onToggleShuffle}
            className={`tv-focus-button w-11 h-11 rounded-full border flex items-center justify-center cursor-pointer ${
              shuffle
                ? 'bg-[#3131C0]/60 border-[#6366F1] text-[#E1E0FF]'
                : 'bg-[#1C2336] border-white/10 hover:border-[#00D2FF] text-[#94A3B8]'
            }`}
          >
            <Shuffle className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Equalizer + Timecode + Mute */}
        <div className="flex items-center gap-5 shrink-0">
          <div aria-hidden="true" className="hidden sm:flex items-end gap-1 h-7">
            {bars.map((val, i) => (
              <span
                key={i}
                className="w-1.5 h-7 rounded-full bg-gradient-to-t from-[#6366F1] to-[#00D2FF] origin-bottom transition-transform duration-100"
                style={{ transform: `scaleY(${val.toFixed(2)})` }}
              />
            ))}
          </div>

          <span className="font-display text-base font-semibold text-[#F8FAFC] tabular-nums whitespace-nowrap">
            {formatTimecode(elapsedSec)} / {formatTimecode(totalSec)}
          </span>

          <button
            type="button"
            aria-label={isMuted ? 'Activar sonido' : 'Silenciar audio'}
            onClick={onToggleMute}
            className="tv-focus-button w-10 h-10 rounded-full bg-[#1C2336] border border-white/10 hover:border-[#00D2FF] text-[#94A3B8] hover:text-[#F8FAFC] flex items-center justify-center cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
};
