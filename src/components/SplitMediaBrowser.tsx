import React, { useEffect, useRef } from 'react';
import {
  Film,
  Image as ImageIcon,
  Music,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Volume2,
  VolumeX,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import type {
  SlideTransitionMode,
  UsbMediaFile,
  UsbMediaKind,
  UsbSortBy,
} from '../types/media';
import { audioEngine } from '../utils/audioEngine';
import { formatTimecode, SLIDE_TRANSITIONS } from '../utils/usbMedia';
import { MediaFilterBar } from './MediaFilterBar';

interface SplitMediaBrowserProps {
  kind: UsbMediaKind;
  files: UsbMediaFile[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onActivateItem: (index: number) => void;
  onBackHome: () => void;
  // Search & Order By
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortBy: UsbSortBy;
  onSortChange: (sort: UsbSortBy) => void;
  // Photo transition props (when kind === 'image')
  transitionMode: SlideTransitionMode;
  onCycleTransition: () => void;
  // Audio player props (when kind === 'audio')
  activeAudioId: string | null;
  isAudioPlaying: boolean;
  audioElapsedSec: number;
  audioShuffle: boolean;
  isAudioMuted: boolean;
  onToggleAudioPlay: () => void;
  onPrevAudio: () => void;
  onNextAudio: () => void;
  onToggleShuffle: () => void;
  onToggleMute: () => void;
  onSeekAudio: (nextSec: number) => void;
}

export const SplitMediaBrowser: React.FC<SplitMediaBrowserProps> = ({
  kind,
  files,
  selectedIndex,
  onSelectIndex,
  onActivateItem,
  onBackHome,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  transitionMode,
  onCycleTransition,
  activeAudioId,
  isAudioPlaying,
  audioElapsedSec,
  audioShuffle,
  isAudioMuted,
  onToggleAudioPlay,
  onPrevAudio,
  onNextAudio,
  onToggleShuffle,
  onToggleMute,
  onSeekAudio,
}) => {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef(0);

  const selectedFile = files[selectedIndex] ?? files[0] ?? null;

  useEffect(() => {
    const target = itemRefs.current[selectedIndex];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedIndex]);

  // Live spectrum analyzer inside Audio right-hand player
  useEffect(() => {
    if (kind !== 'audio') return;
    let rafId = 0;
    const render = () => {
      const canvas = spectrumCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          phaseRef.current += isAudioPlaying ? 0.045 : 0.01;
          const bars = audioEngine.sampleSpectrum(28, isAudioPlaying, phaseRef.current);
          const { width, height } = canvas;
          ctx.clearRect(0, 0, width, height);
          const gap = 6;
          const barW = (width - gap * (bars.length - 1)) / bars.length;

          bars.forEach((level, idx) => {
            const barH = Math.max(8, level * (height - 10));
            const x = idx * (barW + gap);
            const y = height - barH;
            const grad = ctx.createLinearGradient(0, y, 0, height);
            grad.addColorStop(0, '#00D2FF');
            grad.addColorStop(1, '#6366F1');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(x, y, barW, barH, 4);
            ctx.fill();
          });
        }
      }
      rafId = requestAnimationFrame(render);
    };
    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [kind, isAudioPlaying]);

  const title =
    kind === 'video' ? 'Videos en USB' : kind === 'image' ? 'Fotos en USB' : 'Audio en USB';
  const searchPlaceholder =
    kind === 'video'
      ? 'Buscar videos por nombre o formato...'
      : kind === 'image'
      ? 'Buscar fotos por nombre o resolución...'
      : 'Buscar pistas de música o formato...';

  const KindIcon = kind === 'video' ? Film : kind === 'image' ? ImageIcon : Music;
  const activeTransition =
    SLIDE_TRANSITIONS.find((t) => t.id === transitionMode) ?? SLIDE_TRANSITIONS[0];

  const activeAudioDuration = selectedFile?.durationSec ?? 240;
  const isSelectedTrackPlaying =
    kind === 'audio' && selectedFile?.id === activeAudioId && isAudioPlaying;
  const audioProgressPct =
    activeAudioDuration > 0
      ? Math.min(100, (audioElapsedSec / activeAudioDuration) * 100)
      : 0;

  return (
    <section
      aria-label={title}
      className="px-8 lg:px-14 pt-3 pb-28 flex flex-col gap-5"
    >
      {/* Sub-header */}
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
            {title}
          </h1>
          <span className="text-base font-semibold text-[#94A3B8] tabular-nums">
            ({files.length})
          </span>
        </div>

        <p className="text-sm font-semibold text-[#94A3B8]">
          ↑↓ Elegir archivo · Enter {kind === 'video' ? 'Reproducir' : kind === 'image' ? 'Iniciar transición' : 'Reproducir pista'}
        </p>
      </div>

      {/* Search + Order By Bar */}
      <MediaFilterBar
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        sortBy={sortBy}
        onSortChange={onSortChange}
        searchPlaceholder={searchPlaceholder}
        totalMatches={files.length}
        includeDurationSort={kind !== 'image'}
      />

      {files.length === 0 ? (
        <div className="rounded-xl bg-[#121826]/80 border border-white/10 p-12 text-center flex flex-col items-center gap-3">
          <p className="font-display text-xl font-semibold text-[#F8FAFC]">
            {searchQuery.trim()
              ? `No hay coincidencias para "${searchQuery}"`
              : 'No hay archivos en esta categoría'}
          </p>
          <p className="text-base text-[#94A3B8]">
            {searchQuery.trim()
              ? 'Prueba con otro término o limpia el buscador para ver todo el contenido.'
              : 'Carga una carpeta o archivos desde tu unidad USB con los botones superiores.'}
          </p>
          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="mt-2 px-5 py-2.5 rounded-full bg-[#00D2FF] text-[#0B0F19] font-display text-sm font-bold cursor-pointer"
            >
              Limpiar búsqueda
            </button>
          )}
        </div>
      ) : (
        /* Horizontal Split: Left File List (NO thumbnails) | Right Preview / Audio Player */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: Clean File List */}
          <div
            role="listbox" data-media-list=""
            aria-label={`Lista de ${title}`}
            className="lg:col-span-5 flex flex-col gap-3 max-h-[58vh] overflow-y-auto no-scrollbar px-4 py-3 -mx-4"
          >
            {files.map((file, idx) => {
              const isSelected = idx === selectedIndex;
              const isPlayingHere = kind === 'audio' && file.id === activeAudioId && isAudioPlaying;

              return (
                <button
                  key={file.id}
                  ref={(el) => {
                    itemRefs.current[idx] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-focused={isSelected}
                  onClick={() => {
                    onSelectIndex(idx);
                    onActivateItem(idx);
                  }}
                  onMouseEnter={() => onSelectIndex(idx)} onFocus={() => onSelectIndex(idx)}
                  className={`flex items-center justify-between gap-4 px-5 py-4 rounded-xl text-left cursor-pointer border-[3px] transition-all ${
                    isSelected
                      ? 'bg-[#1C2336] border-[#00D2FF] text-[#F8FAFC] shadow-[0_0_20px_rgba(0,210,255,0.35)] scale-[1.015]'
                      : 'bg-[#121826]/85 border-white/10 text-[#BBC9CF] hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-[#00D2FF] text-[#0B0F19]'
                          : 'bg-[#0B0F19]/80 text-[#94A3B8]'
                      }`}
                    >
                      <KindIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display text-base lg:text-lg font-semibold truncate">
                        {file.name}
                      </p>
                      <p className="text-sm text-[#94A3B8] truncate tabular-nums">
                        {file.formatLabel} · {file.sizeLabel}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {isPlayingHere && (
                      <span className="px-2.5 py-1 rounded-full bg-[#22C55E]/20 text-[#64F88A] font-display text-sm font-bold">
                        Sonando
                      </span>
                    )}
                    {file.durationSec && (
                      <span className="font-display text-sm font-semibold text-[#94A3B8] tabular-nums">
                        {formatTimecode(file.durationSec)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* RIGHT: Thumbnail Preview (Video / Fotos) OR Full Music Player (Audio) */}
          <div className="lg:col-span-7 rounded-2xl bg-[#121826]/90 border border-white/10 p-6 lg:p-8 flex flex-col gap-6">
            {selectedFile && (kind === 'video' || kind === 'image') && (
              <>
                <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-[#080B11] border border-white/10">
                  {selectedFile.thumbnailUrl ? (
                    <img
                      src={selectedFile.thumbnailUrl}
                      alt={`Vista previa de ${selectedFile.name}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{
                        background: `radial-gradient(circle at 50% 45%, ${selectedFile.ambientColor}33, #080B11 75%)`,
                      }}
                    >
                      <KindIcon className="w-16 h-16 text-[#94A3B8]" />
                    </div>
                  )}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-[#080B11]/80 via-transparent to-transparent"
                  />
                  <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-display text-xl lg:text-2xl font-bold text-[#F8FAFC] truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-sm text-[#A5E7FF] mt-0.5 tabular-nums">
                        {selectedFile.folderPath} · {selectedFile.formatLabel} · {selectedFile.sizeLabel}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => onActivateItem(selectedIndex)}
                    className="tv-focus-button flex items-center gap-3 px-7 py-3.5 rounded-full bg-[#00D2FF] hover:bg-[#FFFFFF] text-[#0B0F19] font-display text-lg font-bold cursor-pointer shadow-[0_0_24px_rgba(0,210,255,0.35)]"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>
                      {kind === 'video' ? 'Reproducir Video (Enter)' : 'Iniciar con Transición (Enter)'}
                    </span>
                  </button>

                  {kind === 'image' && (
                    <button
                      type="button"
                      onClick={onCycleTransition}
                      className="tv-focus-button flex items-center gap-2.5 px-5 py-3 rounded-lg bg-[#1C2336] border-2 border-[#334155] hover:border-[#6366F1] text-[#F8FAFC] font-display text-base font-semibold cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-[#00D2FF]" />
                      <span>Transición: {activeTransition.label}</span>
                    </button>
                  )}
                </div>
              </>
            )}

            {selectedFile && kind === 'audio' && (
              <div className="flex flex-col gap-6">
                {/* Top Track Presentation */}
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {selectedFile.thumbnailUrl ? (
                    <img
                      src={selectedFile.thumbnailUrl}
                      alt={selectedFile.name}
                      referrerPolicy="no-referrer"
                      className="w-36 h-36 rounded-xl object-cover shrink-0 border border-white/15 shadow-xl"
                    />
                  ) : (
                    <div className="w-36 h-36 rounded-xl bg-[#0B0F19] border border-white/15 flex items-center justify-center shrink-0">
                      <Music className="w-12 h-12 text-[#00D2FF]" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <p className="font-display text-sm font-bold uppercase tracking-wider text-[#00D2FF]">
                      {selectedFile.formatLabel} · {selectedFile.sizeLabel}
                    </p>
                    <h2 className="font-display text-2xl lg:text-3xl font-bold text-[#F8FAFC] truncate mt-1">
                      {selectedFile.name}
                    </h2>
                    <p className="text-base text-[#94A3B8] mt-1">{selectedFile.folderPath}</p>
                  </div>
                </div>

                {/* Live Spectrum Visualizer */}
                <div className="w-full rounded-xl bg-[#0B0F19]/80 border border-white/10 p-4">
                  <canvas
                    ref={spectrumCanvasRef}
                    width={640}
                    height={90}
                    className="w-full h-[76px] block"
                  />
                </div>

                {/* Interactive Scrubber */}
                <div className="flex flex-col gap-2">
                  <div
                    className="relative h-2.5 w-full rounded-full bg-[#1E293B] cursor-pointer"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                      onSeekAudio(Math.round(ratio * activeAudioDuration));
                    }}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#00D2FF] to-[#6366F1]"
                      style={{ width: `${selectedFile.id === activeAudioId ? audioProgressPct : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between font-display text-sm font-semibold text-[#94A3B8] tabular-nums">
                    <span>
                      {selectedFile.id === activeAudioId ? formatTimecode(audioElapsedSec) : '00:00'}
                    </span>
                    <span>{formatTimecode(activeAudioDuration)}</span>
                  </div>
                </div>

                {/* Music Transport Controls */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Pista anterior"
                      onClick={onPrevAudio}
                      className="tv-focus-button w-12 h-12 rounded-full bg-[#1C2336] border border-white/15 hover:border-[#00D2FF] text-[#F8FAFC] flex items-center justify-center cursor-pointer"
                    >
                      <SkipBack className="w-5 h-5" />
                    </button>

                    <button
                      type="button"
                      aria-label={isSelectedTrackPlaying ? 'Pausar música' : 'Reproducir música'}
                      onClick={() => {
                        if (selectedFile.id !== activeAudioId) {
                          onActivateItem(selectedIndex);
                        } else {
                          onToggleAudioPlay();
                        }
                      }}
                      className="tv-focus-button flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-[#00D2FF] hover:bg-[#FFFFFF] text-[#0B0F19] font-display text-lg font-bold cursor-pointer shadow-[0_0_20px_rgba(0,210,255,0.4)]"
                    >
                      {isSelectedTrackPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 fill-current" />
                      )}
                      <span>{isSelectedTrackPlaying ? 'Pausar' : 'Reproducir'}</span>
                    </button>

                    <button
                      type="button"
                      aria-label="Pista siguiente"
                      onClick={onNextAudio}
                      className="tv-focus-button w-12 h-12 rounded-full bg-[#1C2336] border border-white/15 hover:border-[#00D2FF] text-[#F8FAFC] flex items-center justify-center cursor-pointer"
                    >
                      <SkipForward className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label={audioShuffle ? 'Desactivar aleatorio' : 'Activar aleatorio'}
                      onClick={onToggleShuffle}
                      className={`tv-focus-button flex items-center gap-2 px-4 py-2.5 rounded-lg border font-display text-sm font-semibold cursor-pointer ${
                        audioShuffle
                          ? 'bg-[#3131C0]/60 border-[#6366F1] text-[#E1E0FF]'
                          : 'bg-[#1C2336] border-white/15 text-[#94A3B8] hover:text-[#F8FAFC]'
                      }`}
                    >
                      <Shuffle className="w-4 h-4" />
                      <span>Aleatorio</span>
                    </button>

                    <button
                      type="button"
                      aria-label={isAudioMuted ? 'Activar sonido' : 'Silenciar música'}
                      onClick={onToggleMute}
                      className="tv-focus-button w-11 h-11 rounded-lg bg-[#1C2336] border border-white/15 hover:border-[#00D2FF] text-[#F8FAFC] flex items-center justify-center cursor-pointer"
                    >
                      {isAudioMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
