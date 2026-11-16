import type {
  SlideTransitionMode,
  UsbMediaFile,
  UsbMediaKind,
  UsbSortBy,
} from '../types/media';

const VIDEO_EXTS = new Set(['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v']);
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif']);
const AUDIO_EXTS = new Set(['mp3', 'flac', 'wav', 'm4a', 'aac', 'ogg', 'opus']);

export const USB_SORT_OPTIONS: Array<{ id: UsbSortBy; label: string }> = [
  { id: 'name-asc', label: 'Nombre (A–Z)' },
  { id: 'name-desc', label: 'Nombre (Z–A)' },
  { id: 'size-desc', label: 'Mayor tamaño' },
  { id: 'duration-desc', label: 'Mayor duración' },
  { id: 'format', label: 'Formato' },
];

export const SLIDE_TRANSITIONS: Array<{
  id: SlideTransitionMode;
  label: string;
  description: string;
}> = [
  { id: 'fade', label: 'Desvanecer', description: 'Fundido suave entre fotografías' },
  { id: 'ken-burns', label: 'Zoom Ken Burns', description: 'Acercamiento cinematográfico lento' },
  { id: 'slide', label: 'Deslizar', description: 'Desplazamiento horizontal tipo TV' },
  { id: 'blur', label: 'Disolver con Blur', description: 'Transición óptica con desenfoque' },
  { id: 'zoom', label: 'Escala Profunda', description: 'Empuje con profundidad en pantalla' },
  { id: 'none', label: 'Corte Directo', description: 'Cambio instantáneo sin animación' },
];

export function classifyUsbFile(fileName: string, mimeType = ''): UsbMediaKind | null {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';

  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (AUDIO_EXTS.has(ext)) return 'audio';
  return null;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function parseSizeToBytes(file: Pick<UsbMediaFile, 'sizeBytes' | 'sizeLabel'>): number {
  if (typeof file.sizeBytes === 'number' && Number.isFinite(file.sizeBytes)) {
    return file.sizeBytes;
  }
  const match = /^\s*([\d.,]+)\s*(TB|GB|MB|KB|B)\s*$/i.exec(file.sizeLabel || '');
  if (!match) return 0;
  const value = Number.parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(value)) return 0;
  const unit = match[2].toUpperCase();
  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };
  return value * (multipliers[unit] ?? 1);
}

export function formatTimecode(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function filterByKind(files: UsbMediaFile[], kind: UsbMediaKind): UsbMediaFile[] {
  return files.filter((file) => file.kind === kind);
}

export function filterAndSortMedia(
  files: UsbMediaFile[],
  query: string,
  sortBy: UsbSortBy
): UsbMediaFile[] {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? files.filter(
        (file) =>
          file.name.toLowerCase().includes(normalizedQuery) ||
          file.formatLabel.toLowerCase().includes(normalizedQuery) ||
          file.folderPath.toLowerCase().includes(normalizedQuery)
      )
    : [...files];

  return filtered.sort((a, b) => {
    switch (sortBy) {
      case 'name-asc':
        return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      case 'name-desc':
        return b.name.localeCompare(a.name, 'es', { sensitivity: 'base' });
      case 'size-desc': {
        const diff = parseSizeToBytes(b) - parseSizeToBytes(a);
        return diff !== 0 ? diff : a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      }
      case 'duration-desc': {
        const diff = (b.durationSec ?? 0) - (a.durationSec ?? 0);
        return diff !== 0 ? diff : a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      }
      case 'format': {
        const fmtDiff = a.formatLabel.localeCompare(b.formatLabel, 'es', { sensitivity: 'base' });
        return fmtDiff !== 0 ? fmtDiff : a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      }
      default:
        return 0;
    }
  });
}

export function stepListIndex(
  currentIndex: number,
  totalItems: number,
  direction: 'up' | 'down'
): number {
  if (totalItems <= 0) return 0;
  const safe = Math.min(Math.max(0, currentIndex), totalItems - 1);
  if (direction === 'down') {
    return Math.min(totalItems - 1, safe + 1);
  }
  return Math.max(0, safe - 1);
}

export function stepSlideIndex(
  currentIndex: number,
  totalSlides: number,
  direction: 'next' | 'prev'
): number {
  if (totalSlides <= 0) return 0;
  if (direction === 'next') return (currentIndex + 1) % totalSlides;
  return (currentIndex - 1 + totalSlides) % totalSlides;
}

export function cycleTransitionMode(current: SlideTransitionMode): SlideTransitionMode {
  const idx = SLIDE_TRANSITIONS.findIndex((t) => t.id === current);
  if (idx < 0) return SLIDE_TRANSITIONS[0].id;
  return SLIDE_TRANSITIONS[(idx + 1) % SLIDE_TRANSITIONS.length].id;
}

export function getNextTrackIndex(
  currentIndex: number,
  totalTracks: number,
  direction: 'next' | 'prev',
  shuffle: boolean,
  randomFn: () => number = Math.random
): number {
  if (totalTracks <= 0) return 0;
  if (totalTracks === 1) return 0;

  if (shuffle) {
    let candidate = Math.floor(randomFn() * totalTracks);
    if (candidate === currentIndex) {
      candidate = (currentIndex + 1) % totalTracks;
    }
    return candidate;
  }

  if (direction === 'next') return (currentIndex + 1) % totalTracks;
  return (currentIndex - 1 + totalTracks) % totalTracks;
}
