import React, { useEffect, useRef, useState } from 'react';
import { Search, X, ArrowUpDown } from 'lucide-react';
import type { UsbSortBy } from '../types/media';
import { USB_SORT_OPTIONS } from '../utils/usbMedia';

interface MediaFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortBy: UsbSortBy;
  onSortChange: (sort: UsbSortBy) => void;
  searchPlaceholder?: string;
  totalMatches?: number;
  includeDurationSort?: boolean;
}

export const MediaFilterBar: React.FC<MediaFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  searchPlaceholder = 'Buscar archivo por nombre o formato...',
  totalMatches,
  includeDurationSort = true,
}) => {
  const [editing, setEditing] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { if (editing) searchRef.current?.focus(); }, [editing]);
  const options = includeDurationSort
    ? USB_SORT_OPTIONS
    : USB_SORT_OPTIONS.filter((opt) => opt.id !== 'duration-desc');

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#121826]/85 border border-white/10 px-4 py-3">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[240px] max-w-xl flex items-center">
        <Search
          aria-hidden="true"
          className="w-4 h-4 text-[#00D2FF] absolute left-3.5 pointer-events-none"
        />
        <input
          ref={searchRef}
          type="text"
          role="searchbox"
          readOnly={!editing}
          value={searchQuery}
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (!editing && e.key === 'Enter') {
              e.preventDefault();
              // El WebView de Android solo abre el teclado en un foco nuevo: se quita y se devuelve el foco tras habilitar la escritura.
              const el = e.currentTarget;
              el.readOnly = false;
              el.blur();
              el.focus();
              setEditing(true);
            }
            else if (editing && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); setEditing(false); searchRef.current?.blur(); }
          }}
          onBlur={() => setEditing(false)}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Buscar archivos"
          className="w-full pl-10 pr-10 py-2 rounded-lg bg-[#0B0F19]/90 border border-white/15 focus:border-[#00D2FF] focus:outline-none text-sm lg:text-base text-[#F8FAFC] placeholder-[#64748B] font-medium"
        />
        {searchQuery && (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 w-6 h-6 rounded-full bg-[#1C2336] hover:bg-[#00D2FF] text-[#94A3B8] hover:text-[#0B0F19] flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Results count + Order By Selector */}
      <div className="flex items-center gap-3 flex-wrap">
        {typeof totalMatches === 'number' && searchQuery.trim() !== '' && (
          <span className="font-display text-sm font-semibold text-[#A5E7FF] tabular-nums">
            {totalMatches} {totalMatches === 1 ? 'resultado' : 'resultados'}
          </span>
        )}

        <label className="flex items-center gap-2.5 rounded-lg bg-[#0B0F19]/90 border border-white/15 px-3 py-2 focus-within:border-[#00D2FF]">
          <ArrowUpDown aria-hidden="true" className="w-4 h-4 text-[#00D2FF] shrink-0" />
          <span className="font-display text-sm font-semibold text-[#94A3B8] whitespace-nowrap">
            Ordenar por:
          </span>
          <select
            aria-label="Ordenar por"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as UsbSortBy)}
            className="bg-transparent text-sm lg:text-base font-display font-bold text-[#F8FAFC] focus:outline-none cursor-pointer pr-1"
          >
            {options.map((opt) => (
              <option key={opt.id} value={opt.id} className="bg-[#0B0F19] text-[#F8FAFC]">
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
};
