import React from 'react';
import { Film, Image as ImageIcon, Music, Sparkles, ArrowRight, Play } from 'lucide-react';
import type { UsbGroupId, UsbMediaFile, UsbSortBy } from '../types/media';
import { formatTimecode } from '../utils/usbMedia';
import { MediaFilterBar } from './MediaFilterBar';

interface GroupHubViewProps {
  counts: { video: number; image: number; audio: number };
  focusedIndex: number;
  onFocusIndex: (idx: number) => void;
  onEnterGroup: (group: UsbGroupId) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortBy: UsbSortBy;
  onSortChange: (sort: UsbSortBy) => void;
  matchingFiles: UsbMediaFile[];
  onOpenSearchResult: (file: UsbMediaFile) => void;
}

export const GroupHubView: React.FC<GroupHubViewProps> = ({
  counts,
  focusedIndex,
  onFocusIndex,
  onEnterGroup,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  matchingFiles,
  onOpenSearchResult,
}) => {
  const groups: Array<{
    id: UsbGroupId;
    title: string;
    subtitle: string;
    countLabel: string;
    accent: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'video',
      title: 'Video',
      subtitle: 'Lista de videos con vista previa a la derecha y reproducción en 16:9.',
      countLabel: `${counts.video} ${counts.video === 1 ? 'archivo' : 'archivos'}`,
      accent: '#00D2FF',
      icon: Film,
    },
    {
      id: 'image',
      title: 'Fotos',
      subtitle: 'Lista de imágenes con vista previa y presentación con transiciones.',
      countLabel: `${counts.image} ${counts.image === 1 ? 'foto' : 'fotos'}`,
      accent: '#47D6FF',
      icon: ImageIcon,
    },
    {
      id: 'audio',
      title: 'Audio',
      subtitle: 'Lista de música del USB con reproductor completo a la derecha.',
      countLabel: `${counts.audio} ${counts.audio === 1 ? 'pista' : 'pistas'}`,
      accent: '#22C55E',
      icon: Music,
    },
    {
      id: 'photo-audio',
      title: 'Foto + Audio',
      subtitle: 'Reproduce fotografías con transiciones y música al mismo tiempo.',
      countLabel: `${counts.image} fotos · ${counts.audio} pistas`,
      accent: '#6366F1',
      icon: Sparkles,
    },
  ];

  const hasSearch = searchQuery.trim() !== '';

  return (
    <section
      aria-label="Grupos de medios en USB"
      className="px-8 lg:px-14 pt-4 pb-28 flex flex-col gap-6"
    >
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl font-bold text-[#F8FAFC] tracking-tight">
            Selecciona un grupo de tu unidad USB
          </h1>
          <p className="text-lg text-[#94A3B8] mt-1">
            Usa las flechas para elegir un grupo, busca archivos o define el orden de la lista.
          </p>
        </div>

        <MediaFilterBar
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          sortBy={sortBy}
          onSortChange={onSortChange}
          searchPlaceholder="Buscar en todo el USB (videos, fotos o música)..."
          totalMatches={matchingFiles.length}
        />
      </div>

      {hasSearch ? (
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-[#F8FAFC]">
            Resultados en USB ({matchingFiles.length})
          </h2>

          {matchingFiles.length === 0 ? (
            <div className="rounded-xl bg-[#121826]/85 border border-white/10 p-10 text-center flex flex-col items-center gap-4">
              <p className="font-display text-lg font-semibold text-[#F8FAFC]">
                No se encontraron archivos para &ldquo;{searchQuery}&rdquo;
              </p>
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="px-5 py-2.5 rounded-full bg-[#00D2FF] text-[#0B0F19] font-display text-sm font-bold cursor-pointer"
              >
                Limpiar búsqueda
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {matchingFiles.map((file) => {
                const KindIcon =
                  file.kind === 'video' ? Film : file.kind === 'image' ? ImageIcon : Music;
                const kindLabel =
                  file.kind === 'video' ? 'Video' : file.kind === 'image' ? 'Foto' : 'Audio';

                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => onOpenSearchResult(file)}
                    className="tv-focus-button flex items-center justify-between gap-4 px-5 py-4 rounded-xl bg-[#121826]/90 border-2 border-white/10 hover:border-[#00D2FF] text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-11 h-11 rounded-lg bg-[#0B0F19] text-[#00D2FF] flex items-center justify-center shrink-0">
                        <KindIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-base lg:text-lg font-semibold text-[#F8FAFC] truncate">
                          {file.name}
                        </p>
                        <p className="text-sm text-[#94A3B8] truncate tabular-nums">
                          {kindLabel} · {file.formatLabel} · {file.sizeLabel}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {file.durationSec && (
                        <span className="font-display text-sm font-semibold text-[#94A3B8] tabular-nums">
                          {formatTimecode(file.durationSec)}
                        </span>
                      )}
                      <Play className="w-4 h-4 text-[#00D2FF] fill-current" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Clean 4-Group Horizontal Grid (Zero per-file thumbnail clutter) */
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-7">
          {groups.map((group, idx) => {
            const Icon = group.icon;
            const isFocused = focusedIndex === idx;

            return (
              <button
                autoFocus={idx === 0}
                key={group.id}
                type="button"
                data-focused={isFocused}
                aria-label={`Entrar en ${group.title} · ${group.countLabel}`}
                onClick={() => {
                  onFocusIndex(idx);
                  onEnterGroup(group.id);
                }}
                onMouseEnter={() => onFocusIndex(idx)} onFocus={() => onFocusIndex(idx)}
                className={`tv-focus-card relative rounded-2xl p-7 min-h-[280px] flex flex-col justify-between text-left cursor-pointer border-[3px] bg-[#121826]/95 overflow-hidden ${
                  isFocused ? 'border-[#00D2FF]' : 'border-white/10 hover:border-white/25'
                }`}
              >
                {/* Subtle Ambient Group Accent */}
                <div
                  aria-hidden="true"
                  className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
                  style={{ backgroundColor: group.accent }}
                />

                <div className="relative z-10 flex items-center justify-between">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center border border-white/10 bg-[#0B0F19]/80"
                    style={{ color: group.accent }}
                  >
                    <Icon className="w-8 h-8" />
                  </div>

                  <span className="font-display text-sm font-bold text-[#94A3B8] tabular-nums">
                    {group.countLabel}
                  </span>
                </div>

                <div className="relative z-10 mt-7">
                  <h2 className="font-display text-3xl font-bold text-[#F8FAFC]">
                    {group.title}
                  </h2>
                  <p className="text-base text-[#94A3B8] mt-2 leading-relaxed">
                    {group.subtitle}
                  </p>
                </div>

                <div className="relative z-10 mt-6 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-[#00D2FF]">
                  <span>Entrar</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
