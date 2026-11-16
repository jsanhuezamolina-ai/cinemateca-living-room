import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Play,
  Pause,
  SkipForward,
  Maximize2,
  Music,
  Image as ImageIcon,
  Volume2,
  VolumeX,
  ArrowLeft,
} from 'lucide-react';
import type {
  SlideIntervalSec,
  SlideTransitionMode,
  UsbMediaFile,
  UsbSortBy,
} from '../types/media';
import { formatTimecode, SLIDE_TRANSITIONS, stepSlideIndex } from '../utils/usbMedia';
import { MediaFilterBar } from './MediaFilterBar';

interface PhotoAudioMixViewProps {
  photos: UsbMediaFile[];
  audios: UsbMediaFile[];
  selectedPhotoIndex: number;
  onSelectPhotoIndex: (idx: number) => void;
  activeAudioId: string | null;
  activeTrack: UsbMediaFile | null;
  onSelectAudioTrack: (track: UsbMediaFile) => void;
  isAudioPlaying: boolean;
  audioElapsedSec: number;
  isAudioMuted: boolean;
  onToggleAudioPlay: () => void;
  onNextAudio: () => void;
  onToggleAudioMute: () => void;
  transitionMode: SlideTransitionMode;
  onChangeTransition: (mode: SlideTransitionMode) => void;
  intervalSec: SlideIntervalSec;
  onChangeInterval: (sec: SlideIntervalSec) => void;
  onOpenFullscreen: () => void;
  onBackHome: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortBy: UsbSortBy;
  onSortChange: (sort: UsbSortBy) => void;
}

const INTERVAL_OPTIONS: SlideIntervalSec[] = [3, 5, 8, 12];

export const PhotoAudioMixView: React.FC<PhotoAudioMixViewProps> = ({
  photos,
  audios,
  selectedPhotoIndex,
  onSelectPhotoIndex,
  activeAudioId,
  activeTrack,
  onSelectAudioTrack,
  isAudioPlaying,
  audioElapsedSec,
  isAudioMuted,
  onToggleAudioPlay,
  onNextAudio,
  onToggleAudioMute,
  transitionMode,
  onChangeTransition,
  intervalSec,
  onChangeInterval,
  onOpenFullscreen,
  onBackHome,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
}) => {
  const [isPreviewCycling, setIsPreviewCycling] = useState(true);

  const activePhoto = photos[selectedPhotoIndex] ?? photos[0] ?? null;
  const activeAudio = activeTrack ?? audios[0] ?? null;

  // Live simultaneous photo cycling on the right preview stage
  useEffect(() => {
    if (!isPreviewCycling || photos.length <= 1) return;
    const timer = window.setInterval(() => {
      onSelectPhotoIndex(stepSlideIndex(selectedPhotoIndex, photos.length, 'next'));
    }, intervalSec * 1000);
    return () => window.clearInterval(timer);
  }, [isPreviewCycling, intervalSec, photos.length, selectedPhotoIndex, onSelectPhotoIndex]);

  const photoSrc = activePhoto?.objectUrl || activePhoto?.thumbnailUrl || '';

  return (
    <section
      aria-label="Reproducción simultánea de Foto + Audio"
      className="px-8 lg:px-14 pt-3 pb-24 flex flex-col gap-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBackHome}
            className="tv-focus-button flex items-center gap-2 px-4 py-2 rounded-full bg-[#121826] border border-white/15 hover:border-[#00D2FF] text-[#F8FAFC] font-display text-sm font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Grupos</span>
          </button>

          <h1 className="font-display text-2xl lg:text-3xl font-bold text-[#F8FAFC]">
            Foto + Audio Simultáneo
          </h1>
        </div>

        <button
          type="button"
          onClick={onOpenFullscreen}
          disabled={photos.length === 0}
          className="tv-focus-button flex items-center gap-2.5 px-6 py-3 rounded-full bg-[#00D2FF] hover:bg-[#FFFFFF] text-[#0B0F19] font-display text-base font-bold cursor-pointer shadow-[0_0_20px_rgba(0,210,255,0.4)] disabled:opacity-40"
        >
          <Maximize2 className="w-5 h-5" />
          <span>Ver en Pantalla Completa (Enter)</span>
        </button>
      </div>

      {/* Search + Order By Bar */}
      <MediaFilterBar
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        sortBy={sortBy}
        onSortChange={onSortChange}
        searchPlaceholder="Buscar fotos o música por nombre o formato..."
        totalMatches={photos.length + audios.length}
      />

      {/* Main Split: Left Dual Selectors + Transitions | Right Live Photo + Audio Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* LEFT: Photo List + Audio List + Transitions */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Photos List */}
          <div className="rounded-xl bg-[#121826]/90 border border-white/10 p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              {/* Botón pequeño de la sección: Derecha entra a la lista, Izquierda vuelve aquí. */}
              <button
                type="button"
                data-group-chip="photos"
                onClick={() => document.querySelector<HTMLElement>('[data-list-group="photos"] [data-focused="true"]')?.focus()}
                className="tv-focus-button flex items-center gap-2 rounded-full border border-white/10 bg-[#0B0F19]/70 px-3 py-1 text-sm font-display font-bold text-[#F8FAFC] hover:border-[#00D2FF]"
              >
                <ImageIcon className="w-3.5 h-3.5 text-[#00D2FF]" />
                Fotos ({photos.length})
              </button>
            </div>
            <div data-list-group="photos" className="max-h-36 overflow-y-auto no-scrollbar flex flex-col gap-1.5">
              {photos.length === 0 ? (
                <p className="text-sm text-[#94A3B8] py-2">
                  Sin fotos que coincidan con &ldquo;{searchQuery}&rdquo;.
                </p>
              ) : (
                photos.map((photo, idx) => {
                  const selected = idx === selectedPhotoIndex;
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      data-focused={selected}
                      onClick={() => onSelectPhotoIndex(idx)}
                      onFocus={() => onSelectPhotoIndex(idx)}
                      className={`flex items-center justify-between px-3.5 py-2 rounded-lg text-left text-sm font-semibold cursor-pointer border transition-colors ${
                        selected
                          ? 'bg-[#1C2336] border-[#00D2FF] text-[#F8FAFC]'
                          : 'bg-[#0B0F19]/50 border-transparent text-[#94A3B8] hover:text-[#F8FAFC]'
                      }`}
                    >
                      <span className="truncate">{photo.name}</span>
                      <span className="text-xs text-[#64748B] shrink-0 ml-2">{photo.formatLabel}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Audio List */}
          <div className="rounded-xl bg-[#121826]/90 border border-white/10 p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              <button
                type="button"
                data-group-chip="audio"
                onClick={() => document.querySelector<HTMLElement>('[data-list-group="audio"] [data-focused="true"]')?.focus()}
                className="tv-focus-button flex items-center gap-2 rounded-full border border-white/10 bg-[#0B0F19]/70 px-3 py-1 text-sm font-display font-bold text-[#F8FAFC] hover:border-[#22C55E]"
              >
                <Music className="w-3.5 h-3.5 text-[#22C55E]" />
                Música ({audios.length})
              </button>
            </div>
            <div data-list-group="audio" className="max-h-36 overflow-y-auto no-scrollbar flex flex-col gap-1.5">
              {audios.length === 0 ? (
                <p className="text-sm text-[#94A3B8] py-2">
                  Sin pistas que coincidan con &ldquo;{searchQuery}&rdquo;.
                </p>
              ) : (
                audios.map((track) => {
                  const selected = track.id === activeAudioId;
                  return (
                    <button
                      key={track.id}
                      type="button"
                      data-focused={selected}
                      onClick={() => onSelectAudioTrack(track)}
                      className={`flex items-center justify-between px-3.5 py-2 rounded-lg text-left text-sm font-semibold cursor-pointer border transition-colors ${
                        selected
                          ? 'bg-[#1C2336] border-[#22C55E] text-[#F8FAFC]'
                          : 'bg-[#0B0F19]/50 border-transparent text-[#94A3B8] hover:text-[#F8FAFC]'
                      }`}
                    >
                      <span className="truncate">{track.name}</span>
                      <span className="text-xs text-[#64748B] tabular-nums shrink-0 ml-2">
                        {track.durationSec ? formatTimecode(track.durationSec) : track.sizeLabel}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Transition & Interval Controls */}
          <div className="rounded-xl bg-[#121826]/90 border border-white/10 p-4 flex flex-col gap-3">
            <span className="font-display text-base font-bold text-[#F8FAFC]">
              Transición de imágenes
            </span>
            <div className="flex flex-wrap gap-2">
              {SLIDE_TRANSITIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={transitionMode === opt.id}
                  onClick={() => onChangeTransition(opt.id)}
                  className={`px-3 py-1.5 rounded-lg font-display text-sm font-semibold cursor-pointer border transition-colors ${
                    transitionMode === opt.id
                      ? 'bg-[#00D2FF] text-[#0B0F19] border-[#FFFFFF]'
                      : 'bg-[#1C2336] text-[#F8FAFC] border-white/10 hover:border-[#00D2FF]/60'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <span className="text-sm font-semibold text-[#94A3B8] mr-1">Intervalo:</span>
              {INTERVAL_OPTIONS.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => onChangeInterval(sec)}
                  className={`px-3 py-1 rounded-lg font-display text-sm font-bold tabular-nums cursor-pointer border ${
                    intervalSec === sec
                      ? 'bg-[#6366F1] text-[#F8FAFC] border-[#C0C1FF]'
                      : 'bg-[#1C2336] text-[#94A3B8] border-white/10'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Live Simultaneous Photo + Audio Preview Stage */}
        <div className="lg:col-span-7 rounded-2xl bg-[#121826]/90 border border-white/10 p-5 flex flex-col gap-4">
          <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-[#05080F] border border-white/10 flex items-center justify-center">
            {activePhoto ? (
              <AnimatePresence mode="sync">
                <motion.img
                  key={`${activePhoto.id}-${transitionMode}-${selectedPhotoIndex}`}
                  src={photoSrc}
                  alt={activePhoto.name}
                  referrerPolicy="no-referrer"
                  initial={
                    transitionMode === 'slide'
                      ? { x: '100%', opacity: 0.4 }
                      : transitionMode === 'blur'
                      ? { opacity: 0, filter: 'blur(14px)' }
                      : transitionMode === 'zoom'
                      ? { opacity: 0, scale: 0.9 }
                      : { opacity: 0 }
                  }
                  animate={
                    transitionMode === 'ken-burns'
                      ? { opacity: 1, scale: 1.07 }
                      : { x: '0%', opacity: 1, filter: 'blur(0px)', scale: 1 }
                  }
                  exit={{ opacity: 0 }}
                  transition={{ duration: transitionMode === 'none' ? 0.01 : 0.65 }}
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </AnimatePresence>
            ) : (
              <p className="text-[#94A3B8]">Sin fotos cargadas</p>
            )}

            {activePhoto && (
              <div className="absolute bottom-3 left-4 right-4 px-3.5 py-2 rounded-lg bg-[#080B11]/80 backdrop-blur-md flex items-center justify-between text-sm">
                <span className="font-display font-semibold text-[#F8FAFC] truncate">
                  {selectedPhotoIndex + 1} / {photos.length} · {activePhoto.name}
                </span>
                <button
                  type="button"
                  onClick={() => setIsPreviewCycling((c) => !c)}
                  className="text-[#00D2FF] font-display font-bold cursor-pointer shrink-0 ml-3"
                >
                  {isPreviewCycling ? 'Pausar fotos' : 'Reanudar fotos'}
                </button>
              </div>
            )}
          </div>

          {/* Simultaneous Audio Control Bar */}
          {activeAudio && (
            <div data-audio-bar="" className="rounded-xl bg-[#0B0F19]/85 border border-white/10 p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-[#22C55E]/15 text-[#22C55E] flex items-center justify-center shrink-0">
                  <Music className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-base font-bold text-[#F8FAFC] truncate">
                    {activeAudio.name}
                  </p>
                  <p className="text-sm text-[#94A3B8] tabular-nums">
                    {formatTimecode(audioElapsedSec)} / {formatTimecode(activeAudio.durationSec ?? 240)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  aria-label={isAudioPlaying ? 'Pausar audio' : 'Reproducir audio'}
                  onClick={onToggleAudioPlay}
                  className="tv-focus-button flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#00D2FF] hover:bg-[#FFFFFF] text-[#0B0F19] font-display text-sm font-bold cursor-pointer"
                >
                  {isAudioPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                  <span>{isAudioPlaying ? 'Pausar audio' : 'Sonar audio'}</span>
                </button>

                <button
                  type="button"
                  aria-label="Siguiente canción"
                  onClick={onNextAudio}
                  className="tv-focus-button w-10 h-10 rounded-full bg-[#1C2336] border border-white/15 hover:border-[#00D2FF] text-[#F8FAFC] flex items-center justify-center cursor-pointer"
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  aria-label={isAudioMuted ? 'Activar sonido' : 'Silenciar'}
                  onClick={onToggleAudioMute}
                  className="tv-focus-button w-10 h-10 rounded-full bg-[#1C2336] border border-white/15 hover:border-[#00D2FF] text-[#F8FAFC] flex items-center justify-center cursor-pointer"
                >
                  {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
