import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  SlideIntervalSec,
  SlideTransitionMode,
  UsbGroupId,
  UsbMediaFile,
  UsbSortBy,
} from './types/media';
import { audioEngine } from './utils/audioEngine';
import {
  classifyUsbFile,
  cycleTransitionMode,
  filterAndSortMedia,
  filterByKind,
  formatFileSize,
  getNextTrackIndex,
  stepListIndex,
} from './utils/usbMedia';
import { TopNavBar } from './components/TopNavBar';
import { GroupHubView } from './components/GroupHubView';
import { SplitMediaBrowser } from './components/SplitMediaBrowser';
import { PhotoAudioMixView } from './components/PhotoAudioMixView';
import { PhotoSlideshowModal } from './components/PhotoSlideshowModal';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { PersistentAudioBar } from './components/PersistentAudioBar';

const HUB_GROUPS: UsbGroupId[] = ['video', 'image', 'audio', 'photo-audio'];

type SpatialDir = 'up' | 'down' | 'left' | 'right';

// Mueve el foco al elemento visible más cercano en la dirección pulsada.
// Así el D-pad sube de la lista al menú, baja del buscador a la lista y pasa al panel derecho.
function spatialMove(dir: SpatialDir): boolean {
  // Foto + Audio: Derecha desde el botón de sección entra a su lista; Izquierda desde la lista vuelve al botón.
  const focusedEl = document.activeElement as HTMLElement | null;
  const listEl = focusedEl?.closest<HTMLElement>('[data-list-group]');
  if (dir === 'right' && focusedEl?.dataset.groupChip) {
    const target = document.querySelector<HTMLElement>(`[data-list-group="${focusedEl.dataset.groupChip}"] [data-focused="true"]`)
      ?? document.querySelector<HTMLElement>(`[data-list-group="${focusedEl.dataset.groupChip}"] button`);
    if (target) {
      target.focus();
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return true;
    }
  }
  // Foto + Audio: Abajo desde el botón "Música" salta a los controles del reproductor.
  if (dir === 'down' && focusedEl?.dataset.groupChip === 'audio') {
    const bar = document.querySelector<HTMLElement>('[data-audio-bar] button');
    if (bar) {
      bar.focus();
      return true;
    }
  }
  if (dir === 'up' && focusedEl?.closest('[data-audio-bar]')) {
    const chip = document.querySelector<HTMLElement>('[data-group-chip="audio"]');
    if (chip) {
      chip.focus();
      return true;
    }
  }
  if (dir === 'left' && listEl) {
    const chip = document.querySelector<HTMLElement>(`[data-group-chip="${listEl.dataset.listGroup}"]`);
    if (chip) {
      chip.focus();
      return true;
    }
  }
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
  const all = Array.from(
    (dialog ?? document).querySelectorAll<HTMLElement>('button, input, [tabindex="0"]')
  ).filter(
    (el) =>
      !el.hasAttribute('disabled') &&
      !(el instanceof HTMLInputElement && (el.type === 'file' || el.type === 'hidden')) &&
      el.getClientRects().length > 0
  );
  if (all.length === 0) return false;

  const active = document.activeElement as HTMLElement | null;
  if (!active || active === document.body || !all.includes(active)) {
    const current = document.querySelector<HTMLElement>('[data-media-list] [data-focused="true"]');
    (current ?? all[0]).focus();
    return true;
  }

  const ar = active.getBoundingClientRect();
  const ax = ar.left + ar.width / 2;
  const ay = ar.top + ar.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of all) {
    if (el === active) continue;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const dx = x - ax;
    const dy = y - ay;
    const inDir =
      dir === 'up' ? dy < -4 : dir === 'down' ? dy > 4 : dir === 'left' ? dx < -4 : dx > 4;
    if (!inDir) continue;
    const primary = dir === 'up' || dir === 'down' ? Math.abs(dy) : Math.abs(dx);
    const secondary = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
    const score = primary + secondary * 2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  if (!best) return false;
  best.focus();
  best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  return true;
}

export default function App() {
  const [usbFiles, setUsbFiles] = useState<UsbMediaFile[]>([]);
  const [usbLabel, setUsbLabel] = useState('Sin USB cargado');
  const [activeGroup, setActiveGroup] = useState<UsbGroupId>('home');
  const [usbSources, setUsbSources] = useState<Array<{ path: string; label: string; media: number }> | null>(null);

  // Search & Order By State (applies to Grupos, Video, Fotos, Audio, Foto + Audio)
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<UsbSortBy>('name-asc');

  // Selection indices per group
  const [hubFocusIndex, setHubFocusIndex] = useState(0);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [selectedAudioListIndex, setSelectedAudioListIndex] = useState(0);

  // Slideshow & Transition Settings
  const [transitionMode, setTransitionMode] = useState<SlideTransitionMode>('ken-burns');
  const [intervalSec, setIntervalSec] = useState<SlideIntervalSec>(5);
  const [slideshowStartIndex, setSlideshowStartIndex] = useState<number | null>(null);

  // Video Player Overlay
  const [activeVideo, setActiveVideo] = useState<UsbMediaFile | null>(null);

  // Audio Playback State (tracked by ID so sorting/filtering never breaks active track)
  const [activeAudioId, setActiveAudioId] = useState<string | null>(
    () => null
  );
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioElapsedSec, setAudioElapsedSec] = useState(0);
  const [audioShuffle, setAudioShuffle] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  const allVideos = useMemo(() => filterByKind(usbFiles, 'video'), [usbFiles]);
  const allImages = useMemo(() => filterByKind(usbFiles, 'image'), [usbFiles]);
  const allAudios = useMemo(() => filterByKind(usbFiles, 'audio'), [usbFiles]);

  // Filtered & Ordered Lists
  const matchingAllFiles = useMemo(
    () => filterAndSortMedia(usbFiles, searchQuery, sortBy),
    [usbFiles, searchQuery, sortBy]
  );
  const videos = useMemo(
    () => filterAndSortMedia(allVideos, searchQuery, sortBy),
    [allVideos, searchQuery, sortBy]
  );
  const images = useMemo(
    () =>
      filterAndSortMedia(
        allImages,
        searchQuery,
        sortBy === 'duration-desc' ? 'name-asc' : sortBy
      ),
    [allImages, searchQuery, sortBy]
  );
  const audios = useMemo(
    () => filterAndSortMedia(allAudios, searchQuery, sortBy),
    [allAudios, searchQuery, sortBy]
  );

  // Playback playlist (uses ordered audio list; falls back to allAudios if search excludes current track)
  const playbackAudios = useMemo(
    () => (audios.length > 0 ? audios : allAudios),
    [audios, allAudios]
  );

  const currentTrack = useMemo(
    () =>
      allAudios.find((t) => t.id === activeAudioId) ??
      playbackAudios[0] ??
      allAudios[0] ??
      null,
    [allAudios, playbackAudios, activeAudioId]
  );

  const counts = useMemo(
    () => ({
      video: allVideos.length,
      image: allImages.length,
      audio: allAudios.length,
    }),
    [allVideos.length, allImages.length, allAudios.length]
  );

  // Clamp selection indices when search or sort changes list lengths
  useEffect(() => {
    setSelectedVideoIndex((prev) => (videos.length === 0 ? 0 : Math.min(prev, videos.length - 1)));
  }, [videos.length]);

  useEffect(() => {
    setSelectedPhotoIndex((prev) => (images.length === 0 ? 0 : Math.min(prev, images.length - 1)));
  }, [images.length]);

  useEffect(() => {
    setSelectedAudioListIndex((prev) =>
      audios.length === 0 ? 0 : Math.min(prev, audios.length - 1)
    );
  }, [audios.length]);

  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q);
    setSelectedVideoIndex(0);
    setSelectedPhotoIndex(0);
    setSelectedAudioListIndex(0);
  }, []);

  const handleSortChange = useCallback((nextSort: UsbSortBy) => {
    setSortBy(nextSort);
    setSelectedVideoIndex(0);
    setSelectedPhotoIndex(0);
    setSelectedAudioListIndex(0);
  }, []);

  // Puente Android: lista de orígenes (USB, almacenamiento interno, carpeta TV) para elegir.
  useEffect(() => {
    (window as unknown as { onUsbSources?: (list: Array<{ path: string; label: string; media: number }>) => void }).onUsbSources = (list) => {
      if (list.length === 0) {
        setUsbLabel('No se detecta ningún USB ni almacenamiento');
        return;
      }
      setUsbSources(list);
    };
    return () => { delete (window as unknown as { onUsbSources?: unknown }).onUsbSources; };
  }, []);

  // Puente Android: la app nativa envía los archivos de la carpeta USB elegida en el TV.
  useEffect(() => {
    type NativeUsbItem = { name: string; folder: string; mime: string; size: number; url: string };
    (window as unknown as { onUsbFiles?: (payload: { root: string; files: NativeUsbItem[]; error?: string }) => void }).onUsbFiles = (payload) => {
      if (payload.error) {
        setUsbLabel(payload.error);
        return;
      }
      const imported: UsbMediaFile[] = [];
      payload.files.forEach((f, idx) => {
        const kind = classifyUsbFile(f.name, f.mime);
        if (!kind) return;
        imported.push({
          id: `usb-native-${Date.now()}-${idx}`,
          name: f.name,
          folderPath: f.folder ? `/USB/${f.folder}` : '/USB',
          kind,
          formatLabel: f.name.split('.').pop()?.toUpperCase() || kind.toUpperCase(),
          sizeLabel: formatFileSize(f.size),
          sizeBytes: f.size,
          durationSec: kind === 'audio' ? 240 : undefined,
          thumbnailUrl: kind === 'image' ? f.url : undefined,
          objectUrl: f.url,
          ambientColor: kind === 'video' ? '#00D2FF' : kind === 'image' ? '#6366F1' : '#22C55E',
          baseFrequencies: kind === 'audio' ? [130.81, 196.0, 246.94, 329.63] : undefined,
        });
      });
      if (imported.length === 0) {
        setUsbLabel(`USB ${payload.root}: sin archivos multimedia`);
        return;
      }
      setUsbFiles((prev) => [...imported, ...prev]);
      setUsbLabel(`USB: ${payload.root} (${imported.length})`);
      setSelectedVideoIndex(0);
      setSelectedPhotoIndex(0);
      setSelectedAudioListIndex(0);
      const firstAudio = imported.find((f) => f.kind === 'audio');
      if (firstAudio) setActiveAudioId(firstAudio.id);
    };
    return () => { delete (window as unknown as { onUsbFiles?: unknown }).onUsbFiles; };
  }, []);

  // Detiene audio, video y presentación: se usa al salir de cualquier módulo.
  const stopAllMedia = useCallback(() => {
    audioEngine.stop();
    setIsAudioPlaying(false);
    setActiveVideo(null);
    setSlideshowStartIndex(null);
  }, []);

  // Botón Atrás de Android: true si consumió la acción (cerrar o volver a Grupos).
  useEffect(() => {
    (window as unknown as { androidBack?: () => boolean }).androidBack = () => {
      if (usbSources) { setUsbSources(null); return true; }
      if (activeVideo) { setActiveVideo(null); return true; }
      if (slideshowStartIndex !== null) { setSlideshowStartIndex(null); return true; }
      if (activeGroup !== 'home') { setSearchQuery(''); stopAllMedia(); setActiveGroup('home'); setHubFocusIndex(0); return true; }
      return false;
    };
    return () => { delete (window as unknown as { androidBack?: unknown }).androidBack; };
  }, [activeVideo, slideshowStartIndex, activeGroup, usbSources, stopAllMedia]);

  // Import real local USB folder or files
  const handleImportUsbFiles = useCallback((fileList: FileList) => {
    const imported: UsbMediaFile[] = [];
    let detectedRootName = '';

    Array.from(fileList).forEach((file, idx) => {
      const kind = classifyUsbFile(file.name, file.type);
      if (!kind) return;

      const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || '';
      if (!detectedRootName && relPath.includes('/')) {
        detectedRootName = relPath.split('/')[0];
      }

      const folderPart = relPath.includes('/')
        ? `/USB/${relPath.split('/').slice(0, -1).join('/')}`
        : '/USB/Importado';

      const objectUrl = URL.createObjectURL(file);
      const ext = file.name.split('.').pop()?.toUpperCase() || kind.toUpperCase();

      imported.push({
        id: `usb-local-${Date.now()}-${idx}`,
        name: file.name,
        folderPath: folderPart,
        kind,
        formatLabel: ext,
        sizeLabel: formatFileSize(file.size),
        sizeBytes: file.size,
        durationSec: kind === 'audio' ? 240 : undefined,
        thumbnailUrl: kind === 'image' ? objectUrl : undefined,
        objectUrl,
        ambientColor: kind === 'video' ? '#00D2FF' : kind === 'image' ? '#6366F1' : '#22C55E',
        baseFrequencies: kind === 'audio' ? [130.81, 196.0, 246.94, 329.63] : undefined,
      });
    });

    if (imported.length > 0) {
      setUsbFiles((prev) => [...imported, ...prev]);
      setUsbLabel(
        detectedRootName ? `USB: ${detectedRootName}` : `USB Local (${imported.length} nuevos)`
      );
      setSelectedVideoIndex(0);
      setSelectedPhotoIndex(0);
      setSelectedAudioListIndex(0);
      const firstNewAudio = imported.find((f) => f.kind === 'audio');
      if (firstNewAudio) {
        setActiveAudioId(firstNewAudio.id);
      }
    }
  }, []);

  // Audio playback controls
  const playTrack = useCallback(
    (track: UsbMediaFile, resetElapsed = true) => {
      setActiveAudioId(track.id);
      const visibleIdx = audios.findIndex((a) => a.id === track.id);
      if (visibleIdx >= 0) {
        setSelectedAudioListIndex(visibleIdx);
      }
      const startAt = resetElapsed ? 0 : audioElapsedSec;
      if (resetElapsed) setAudioElapsedSec(0);
      setIsAudioPlaying(true);
      audioEngine.startTrack(
        track.baseFrequencies ?? [130.81, 196.0, 246.94],
        track.objectUrl,
        startAt
      );
    },
    [audios, audioElapsedSec]
  );

  const handleToggleAudioPlay = useCallback(() => {
    if (!currentTrack) return;
    if (isAudioPlaying) {
      audioEngine.stop();
      setIsAudioPlaying(false);
    } else {
      setActiveAudioId(currentTrack.id);
      setIsAudioPlaying(true);
      audioEngine.startTrack(
        currentTrack.baseFrequencies ?? [130.81, 196.0, 246.94],
        currentTrack.objectUrl,
        audioElapsedSec
      );
    }
  }, [currentTrack, isAudioPlaying, audioElapsedSec]);

  const handleNextAudio = useCallback(() => {
    if (playbackAudios.length === 0) return;
    const currIdx = Math.max(
      0,
      playbackAudios.findIndex((t) => t.id === (currentTrack?.id ?? activeAudioId))
    );
    const nextIdx = getNextTrackIndex(currIdx, playbackAudios.length, 'next', audioShuffle);
    const nextTrack = playbackAudios[nextIdx];
    if (nextTrack) playTrack(nextTrack, true);
  }, [playbackAudios, currentTrack, activeAudioId, audioShuffle, playTrack]);

  const handlePrevAudio = useCallback(() => {
    if (playbackAudios.length === 0) return;
    const currIdx = Math.max(
      0,
      playbackAudios.findIndex((t) => t.id === (currentTrack?.id ?? activeAudioId))
    );
    const prevIdx = getNextTrackIndex(currIdx, playbackAudios.length, 'prev', audioShuffle);
    const prevTrack = playbackAudios[prevIdx];
    if (prevTrack) playTrack(prevTrack, true);
  }, [playbackAudios, currentTrack, activeAudioId, audioShuffle, playTrack]);

  // Audio progress ticker
  useEffect(() => {
    if (!isAudioPlaying || !currentTrack) return;
    const total = currentTrack.durationSec ?? 240;
    const timer = window.setInterval(() => {
      setAudioElapsedSec((prev) => {
        if (prev + 1 >= total) {
          const currIdx = Math.max(
            0,
            playbackAudios.findIndex((t) => t.id === currentTrack.id)
          );
          const nextIdx = getNextTrackIndex(currIdx, playbackAudios.length, 'next', audioShuffle);
          const nextTrack = playbackAudios[nextIdx];
          if (nextTrack) {
            setActiveAudioId(nextTrack.id);
            audioEngine.startTrack(
              nextTrack.baseFrequencies ?? [130.81, 196.0, 246.94],
              nextTrack.objectUrl,
              0
            );
          }
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isAudioPlaying, currentTrack, playbackAudios, audioShuffle]);

  const handleSelectGroup = useCallback(
    (group: UsbGroupId) => {
      if (group !== activeGroup) stopAllMedia();
      setSearchQuery('');
      setActiveGroup(group);
      if (group === 'home') setHubFocusIndex(0);
      // Foto + Audio arranca con la música lista y sonando.
      if (group === 'photo-audio' && currentTrack) {
        playTrack(currentTrack, false);
      }
    },
    [activeGroup, currentTrack, playTrack, stopAllMedia]
  );

  const handleOpenVideo = useCallback(
    (file: UsbMediaFile) => {
      if (isAudioPlaying) {
        audioEngine.stop();
        setIsAudioPlaying(false);
      }
      setActiveVideo(file);
    },
    [isAudioPlaying]
  );

  const handleStartSlideshow = useCallback(
    (startPhotoIndex: number, withAudio: boolean) => {
      if (images.length === 0) return;
      setSlideshowStartIndex(startPhotoIndex);
      if (withAudio && currentTrack && !isAudioPlaying) {
        playTrack(currentTrack, false);
      }
    },
    [images.length, currentTrack, isAudioPlaying, playTrack]
  );

  const handleOpenSearchResult = useCallback(
    (file: UsbMediaFile) => {
      setSearchQuery('');
      if (file.kind === 'video') {
        const sortedVideos = filterAndSortMedia(allVideos, '', sortBy);
        const idx = Math.max(0, sortedVideos.findIndex((f) => f.id === file.id));
        setSelectedVideoIndex(idx);
        setActiveGroup('video');
        handleOpenVideo(file);
      } else if (file.kind === 'image') {
        const sortedImages = filterAndSortMedia(
          allImages,
          '',
          sortBy === 'duration-desc' ? 'name-asc' : sortBy
        );
        const idx = Math.max(0, sortedImages.findIndex((f) => f.id === file.id));
        setSelectedPhotoIndex(idx);
        setActiveGroup('image');
      } else {
        const sortedAudios = filterAndSortMedia(allAudios, '', sortBy);
        const idx = Math.max(0, sortedAudios.findIndex((f) => f.id === file.id));
        setSelectedAudioListIndex(idx);
        setActiveGroup('audio');
        playTrack(file, true);
      }
    },
    [allVideos, allImages, allAudios, sortBy, handleOpenVideo, playTrack]
  );

  // D-Pad Keyboard Navigation per Group
  useEffect(() => {
    if (activeVideo || slideshowStartIndex !== null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Reproductor de video abierto: sus propios controles manejan el teclado.
      if (document.querySelector('[data-video-modal]')) return;
      // Presentación a pantalla completa: sus propios controles manejan el teclado.
      if (document.querySelector('[data-fullscreen-modal]')) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping = (tag === 'INPUT' && !(target as HTMLInputElement).readOnly) || tag === 'TEXTAREA';

      if (tag === 'SELECT' || isTyping) {
        if (e.key === 'Escape') target?.blur();
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setSearchQuery('');
        stopAllMedia();
        setActiveGroup('home');
        setHubFocusIndex(0);
        return;
      }

      const nothingFocused = !target || target === document.body;

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const dir = e.key.replace('Arrow', '').toLowerCase() as SpatialDir;
        if (spatialMove(dir)) e.preventDefault();
        return;
      }

      // Enter en listas lo maneja el elemento enfocado (botón nativo). Foto + Audio no tiene lista,
      // así que ahí Enter inicia la presentación si nada está enfocado.
      if (e.key === 'Enter' && nothingFocused && activeGroup === 'photo-audio') {
        e.preventDefault();
        handleStartSlideshow(selectedPhotoIndex, true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeVideo,
    slideshowStartIndex,
    activeGroup,
    searchQuery,
    hubFocusIndex,
    videos,
    images,
    audios,
    selectedVideoIndex,
    selectedPhotoIndex,
    selectedAudioListIndex,
    currentTrack,
    handleSelectGroup,
    handleOpenVideo,
    handleStartSlideshow,
    handleToggleAudioPlay,
    playTrack,
  ]);

  const showFloatingAudioBar =
    Boolean(currentTrack) &&
    isAudioPlaying &&
    slideshowStartIndex === null &&
    activeGroup !== 'audio' &&
    activeGroup !== 'photo-audio' &&
    !activeVideo &&
    slideshowStartIndex === null;

  return (
    <div className="relative min-h-screen bg-[#0B0F19] text-[#F8FAFC] overflow-x-hidden">
      {/* Subtle Ambient Glow */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(circle at 78% 15%, rgba(0, 210, 255, 0.14) 0%, transparent 45%), radial-gradient(circle at 18% 72%, rgba(99, 102, 241, 0.12) 0%, transparent 50%)',
        }}
      />

      <TopNavBar
        activeGroup={activeGroup}
        onSelectGroup={handleSelectGroup}
        counts={counts}
        usbLabel={usbLabel}
        onImportFiles={handleImportUsbFiles}
      />

      <main className="relative z-10">
        {activeGroup === 'home' && (
          <GroupHubView
            counts={counts}
            focusedIndex={hubFocusIndex}
            onFocusIndex={setHubFocusIndex}
            onEnterGroup={handleSelectGroup}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            matchingFiles={matchingAllFiles}
            onOpenSearchResult={handleOpenSearchResult}
          />
        )}

        {activeGroup === 'video' && (
          <SplitMediaBrowser
            kind="video"
            files={videos}
            selectedIndex={selectedVideoIndex}
            onSelectIndex={setSelectedVideoIndex}
            onActivateItem={(idx) => {
              const target = videos[idx];
              if (target) handleOpenVideo(target);
            }}
            onBackHome={() => handleSelectGroup('home')}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            transitionMode={transitionMode}
            onCycleTransition={() => setTransitionMode((m) => cycleTransitionMode(m))}
            activeAudioId={currentTrack?.id ?? null}
            isAudioPlaying={isAudioPlaying}
            audioElapsedSec={audioElapsedSec}
            audioShuffle={audioShuffle}
            isAudioMuted={isAudioMuted}
            onToggleAudioPlay={handleToggleAudioPlay}
            onPrevAudio={handlePrevAudio}
            onNextAudio={handleNextAudio}
            onToggleShuffle={() => setAudioShuffle((s) => !s)}
            onToggleMute={() => {
              const next = !isAudioMuted;
              setIsAudioMuted(next);
              audioEngine.setMuted(next);
            }}
            onSeekAudio={setAudioElapsedSec}
          />
        )}

        {activeGroup === 'image' && (
          <SplitMediaBrowser
            kind="image"
            files={images}
            selectedIndex={selectedPhotoIndex}
            onSelectIndex={setSelectedPhotoIndex}
            onActivateItem={(idx) => handleStartSlideshow(idx, false)}
            onBackHome={() => handleSelectGroup('home')}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            sortBy={sortBy === 'duration-desc' ? 'name-asc' : sortBy}
            onSortChange={handleSortChange}
            transitionMode={transitionMode}
            onCycleTransition={() => setTransitionMode((m) => cycleTransitionMode(m))}
            activeAudioId={currentTrack?.id ?? null}
            isAudioPlaying={isAudioPlaying}
            audioElapsedSec={audioElapsedSec}
            audioShuffle={audioShuffle}
            isAudioMuted={isAudioMuted}
            onToggleAudioPlay={handleToggleAudioPlay}
            onPrevAudio={handlePrevAudio}
            onNextAudio={handleNextAudio}
            onToggleShuffle={() => setAudioShuffle((s) => !s)}
            onToggleMute={() => {
              const next = !isAudioMuted;
              setIsAudioMuted(next);
              audioEngine.setMuted(next);
            }}
            onSeekAudio={setAudioElapsedSec}
          />
        )}

        {activeGroup === 'audio' && (
          <SplitMediaBrowser
            kind="audio"
            files={audios}
            selectedIndex={selectedAudioListIndex}
            onSelectIndex={setSelectedAudioListIndex}
            onActivateItem={(idx) => {
              const target = audios[idx];
              if (!target) return;
              if (target.id === currentTrack?.id) {
                handleToggleAudioPlay();
              } else {
                playTrack(target, true);
              }
            }}
            onBackHome={() => handleSelectGroup('home')}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            sortBy={sortBy}
            onSortChange={handleSortChange}
            transitionMode={transitionMode}
            onCycleTransition={() => setTransitionMode((m) => cycleTransitionMode(m))}
            activeAudioId={currentTrack?.id ?? null}
            isAudioPlaying={isAudioPlaying}
            audioElapsedSec={audioElapsedSec}
            audioShuffle={audioShuffle}
            isAudioMuted={isAudioMuted}
            onToggleAudioPlay={handleToggleAudioPlay}
            onPrevAudio={handlePrevAudio}
            onNextAudio={handleNextAudio}
            onToggleShuffle={() => setAudioShuffle((s) => !s)}
            onToggleMute={() => {
              const next = !isAudioMuted;
              setIsAudioMuted(next);
              audioEngine.setMuted(next);
            }}
            onSeekAudio={(nextSec) => {
              setAudioElapsedSec(nextSec);
              if (isAudioPlaying && currentTrack) {
                audioEngine.startTrack(
                  currentTrack.baseFrequencies ?? [130.81, 196.0, 246.94],
                  currentTrack.objectUrl,
                  nextSec
                );
              }
            }}
          />
        )}

        {activeGroup === 'photo-audio' && (
          <PhotoAudioMixView
            photos={images}
            audios={audios}
            selectedPhotoIndex={selectedPhotoIndex}
            onSelectPhotoIndex={setSelectedPhotoIndex}
            activeAudioId={currentTrack?.id ?? null}
            activeTrack={currentTrack}
            onSelectAudioTrack={(track) => playTrack(track, true)}
            isAudioPlaying={isAudioPlaying}
            audioElapsedSec={audioElapsedSec}
            isAudioMuted={isAudioMuted}
            onToggleAudioPlay={handleToggleAudioPlay}
            onNextAudio={handleNextAudio}
            onToggleAudioMute={() => {
              const next = !isAudioMuted;
              setIsAudioMuted(next);
              audioEngine.setMuted(next);
            }}
            transitionMode={transitionMode}
            onChangeTransition={setTransitionMode}
            intervalSec={intervalSec}
            onChangeInterval={setIntervalSec}
            onOpenFullscreen={() => handleStartSlideshow(selectedPhotoIndex, true)}
            onBackHome={() => handleSelectGroup('home')}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            sortBy={sortBy}
            onSortChange={handleSortChange}
          />
        )}
      </main>

      {/* Mini Audio Bar when playing music in the background on other views */}
      {showFloatingAudioBar && currentTrack && (
        <PersistentAudioBar
          track={currentTrack}
          isPlaying={isAudioPlaying}
          elapsedSec={audioElapsedSec}
          shuffle={audioShuffle}
          isMuted={isAudioMuted}
          onTogglePlay={handleToggleAudioPlay}
          onPrev={handlePrevAudio}
          onNext={handleNextAudio}
          onToggleShuffle={() => setAudioShuffle((s) => !s)}
          onToggleMute={() => {
            const next = !isAudioMuted;
            setIsAudioMuted(next);
            audioEngine.setMuted(next);
          }}
          onSeek={(nextSec) => {
            setAudioElapsedSec(nextSec);
            if (isAudioPlaying) {
              audioEngine.startTrack(
                currentTrack.baseFrequencies ?? [130.81, 196.0, 246.94],
                currentTrack.objectUrl,
                nextSec
              );
            }
          }}
        />
      )}

      {/* Fullscreen Photo Slideshow (with transitions & optional simultaneous audio) */}
      {slideshowStartIndex !== null && images.length > 0 && (
        <PhotoSlideshowModal
showAudio={activeGroup === 'photo-audio'}
                    photos={images}
          initialPhotoIndex={slideshowStartIndex}
          transitionMode={transitionMode}
          onChangeTransition={setTransitionMode}
          intervalSec={intervalSec}
          onChangeInterval={setIntervalSec}
          activeTrack={currentTrack}
          isAudioPlaying={isAudioPlaying}
          isAudioMuted={isAudioMuted}
          onToggleAudioPlay={handleToggleAudioPlay}
          onNextAudio={handleNextAudio}
          onToggleAudioMute={() => {
            const next = !isAudioMuted;
            setIsAudioMuted(next);
            audioEngine.setMuted(next);
          }}
          onClose={() => setSlideshowStartIndex(null)}
        />
      )}

      {usbSources && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div role="dialog" aria-modal="true" className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0B0F19] p-8 shadow-2xl">
            <h2 className="mb-1 font-display text-2xl font-bold text-[#F8FAFC]">Elige qué revisar</h2>
            <p className="mb-6 text-sm text-[#94A3B8]">Selecciona el origen con el control. Se leerá solo ese.</p>
            <div className="flex flex-col gap-3">
              {usbSources.map((src, i) => (
                <button
                  key={src.path}
                  type="button"
                  autoFocus={i === 0}
                  onClick={() => {
                    setUsbSources(null);
                    (window as unknown as { AndroidUsb?: { scanSource: (p: string) => void } }).AndroidUsb?.scanSource(src.path);
                  }}
                  className="tv-focus-button flex items-center justify-between rounded-xl border-2 border-white/10 bg-[#121826] px-6 py-4 text-left text-lg font-semibold text-[#F8FAFC] hover:border-[#00D2FF]"
                >
                  <span>{src.label}</span>
                  <span className="text-sm text-[#94A3B8] tabular-nums">{src.media} archivo(s)</span>
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setUsbSources(null)} className="tv-focus-button rounded-lg bg-[#1C2336] px-5 py-2.5 text-sm font-semibold text-[#F8FAFC]">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Video Player */}
      {activeVideo && (
        <VideoPlayerModal
          key={activeVideo.id}
          file={activeVideo}
          onClose={() => setActiveVideo(null)}
          position={`${Math.max(1, videos.findIndex((v) => v.id === activeVideo.id) + 1)} / ${videos.length}`}
          onPrev={(() => { const i = videos.findIndex((v) => v.id === activeVideo.id); return i > 0 ? () => setActiveVideo(videos[i - 1]) : undefined; })()}
          onNext={(() => { const i = videos.findIndex((v) => v.id === activeVideo.id); return i >= 0 && i < videos.length - 1 ? () => setActiveVideo(videos[i + 1]) : undefined; })()}
        />
      )}
    </div>
  );
}
