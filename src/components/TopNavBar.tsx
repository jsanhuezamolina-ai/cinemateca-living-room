import React, { useRef } from 'react';
import {
  Film,
  Image as ImageIcon,
  Music,
  Sparkles,
  LayoutGrid,
  FolderOpen,
  HardDrive,
} from 'lucide-react';
import type { UsbGroupId } from '../types/media';

interface TopNavBarProps {
  activeGroup: UsbGroupId;
  onSelectGroup: (group: UsbGroupId) => void;
  counts: { video: number; image: number; audio: number };
  usbLabel: string;
  onImportFiles: (files: FileList) => void;
}

const GROUP_TABS: Array<{
  id: UsbGroupId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'home', label: 'Grupos', icon: LayoutGrid },
  { id: 'video', label: 'Video', icon: Film },
  { id: 'image', label: 'Fotos', icon: ImageIcon },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'photo-audio', label: 'Foto + Audio', icon: Sparkles },
];

export const TopNavBar: React.FC<TopNavBarProps> = ({
  activeGroup,
  onSelectGroup,
  counts,
  usbLabel,
  onImportFiles,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const renderTab = (tab: (typeof GROUP_TABS)[number], variant: 'home' | 'media') => {
    const Icon = tab.icon;
    const isActive = activeGroup === tab.id;
    const badgeCount =
      tab.id === 'video' ? counts.video : tab.id === 'image' ? counts.image : tab.id === 'audio' ? counts.audio : null;
    const base = 'tv-focus-button relative flex items-center gap-2 px-3.5 py-2 text-[15px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors';
    const shape = variant === 'home' ? 'rounded-full border-2' : 'rounded-full';
    const state = isActive
      ? 'bg-[#1C2336] text-[#F8FAFC] border-[#00D2FF]/60'
      : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#121826] border-transparent';
    return (
      <button
        key={tab.id}
        type="button"
        aria-current={isActive ? 'page' : undefined}
        onClick={() => onSelectGroup(tab.id)}
        className={`${base} ${shape} ${state}`}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span>{tab.label}</span>
        {badgeCount !== null && <span className="text-sm text-[#64748B] tabular-nums">{badgeCount}</span>}
      </button>
    );
  };

  return (
    <header className="relative z-40 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-8 lg:px-14 pt-6 pb-4">
      {/* Zone 2: Inicio + cápsula de 4 grupos multimedia */}
      <nav aria-label="Grupos multimedia USB" className="flex items-center gap-3 flex-wrap">
        {renderTab(GROUP_TABS[0], 'home')}
        <div className="flex items-center gap-1 rounded-full bg-[#121826]/85 border border-white/10 p-1">
          {GROUP_TABS.slice(1).map((tab) => renderTab(tab, 'media'))}
        </div>
      </nav>

      {/* Zone 3: USB Status + Load Folder/Files */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div
          className="hidden xl:flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#121826]/85 border border-[#22C55E]/40 text-sm font-semibold text-[#F8FAFC] whitespace-nowrap"
          aria-label={`Estado USB: ${usbLabel}`}
        >
          <span
            aria-hidden="true"
            className="w-2.5 h-2.5 rounded-full bg-[#22C55E] shadow-[0_0_8px_#22C55E]"
          />
          <HardDrive className="w-4 h-4 text-[#22C55E] shrink-0" />
          <span>{usbLabel}</span>
        </div>

        <input
          ref={folderInputRef}
          type="file"
          multiple
          // @ts-expect-error webkitdirectory supported on Chromium / Android TV WebView
          webkitdirectory=""
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onImportFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/*,audio/*,image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onImportFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />

        <button
          type="button"
          onClick={() => { const native = (window as unknown as { AndroidUsb?: { pickFolder: () => void } }).AndroidUsb; if (native) native.pickFolder(); else folderInputRef.current?.click(); }}
          className="tv-focus-button flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#1C2336] border border-white/15 hover:border-[#00D2FF] text-[#F8FAFC] font-display text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
        >
          <FolderOpen className="w-4 h-4 text-[#22C55E] shrink-0" />
          <span>Carpeta USB</span>
        </button>

      </div>
    </header>
  );
};
