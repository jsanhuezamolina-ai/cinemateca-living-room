export type UsbMediaKind = 'video' | 'image' | 'audio';

export type UsbGroupId = 'home' | 'video' | 'image' | 'audio' | 'photo-audio';

export type SlideTransitionMode =
  | 'fade'
  | 'slide'
  | 'ken-burns'
  | 'blur'
  | 'zoom'
  | 'none';

export type SlideIntervalSec = 3 | 5 | 8 | 12;

export type UsbSortBy =
  | 'name-asc'
  | 'name-desc'
  | 'size-desc'
  | 'duration-desc'
  | 'format';

export interface UsbMediaFile {
  id: string;
  name: string;
  folderPath: string;
  kind: UsbMediaKind;
  formatLabel: string;
  sizeLabel: string;
  sizeBytes?: number;
  durationSec?: number;
  thumbnailUrl?: string;
  objectUrl?: string;
  ambientColor: string;
  baseFrequencies?: number[];
}
