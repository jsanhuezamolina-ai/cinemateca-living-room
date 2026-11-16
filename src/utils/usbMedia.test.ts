import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyUsbFile,
  cycleTransitionMode,
  filterAndSortMedia,
  filterByKind,
  formatFileSize,
  formatTimecode,
  getNextTrackIndex,
  parseSizeToBytes,
  stepListIndex,
  stepSlideIndex,
} from './usbMedia';
import type { UsbMediaFile } from '../types/media';

test('classifyUsbFile detects video, image, and audio files by MIME or extension', () => {
  assert.equal(classifyUsbFile('Vacaciones.MKV', ''), 'video');
  assert.equal(classifyUsbFile('clip.mp4', 'video/mp4'), 'video');
  assert.equal(classifyUsbFile('Atardecer.JPG', ''), 'image');
  assert.equal(classifyUsbFile('foto.webp', 'image/webp'), 'image');
  assert.equal(classifyUsbFile('Tema_01.flac', ''), 'audio');
  assert.equal(classifyUsbFile('musica.mp3', 'audio/mpeg'), 'audio');
  assert.equal(classifyUsbFile('readme.txt', 'text/plain'), null);
});

test('formatFileSize and formatTimecode format cleanly', () => {
  assert.equal(formatFileSize(1024 * 512), '512 KB');
  assert.equal(formatFileSize(1024 * 1024 * 24.5), '24.5 MB');
  assert.equal(formatFileSize(1024 * 1024 * 1024 * 3.2), '3.2 GB');
  assert.equal(formatTimecode(204), '03:24');
  assert.equal(formatTimecode(3665), '1:01:05');
});

test('filterByKind returns matching group items', () => {
  const sample: UsbMediaFile[] = [
    { id: '1', name: 'v.mp4', folderPath: '/USB', kind: 'video', formatLabel: 'MP4', sizeLabel: '1 GB', ambientColor: '#00D2FF' },
    { id: '2', name: 'f.jpg', folderPath: '/USB', kind: 'image', formatLabel: 'JPG', sizeLabel: '4 MB', ambientColor: '#00D2FF' },
    { id: '3', name: 'a.mp3', folderPath: '/USB', kind: 'audio', formatLabel: 'MP3', sizeLabel: '8 MB', ambientColor: '#00D2FF' },
  ];

  assert.equal(filterByKind(sample, 'video').length, 1);
  assert.equal(filterByKind(sample, 'image').length, 1);
  assert.equal(filterByKind(sample, 'audio').length, 1);
});

test('parseSizeToBytes parses size labels and filterAndSortMedia searches and orders accurately', () => {
  const files: UsbMediaFile[] = [
    { id: 'b', name: 'Zorro.mkv', folderPath: '/USB/Videos', kind: 'video', formatLabel: '4K MKV', sizeLabel: '500 MB', durationSec: 120, ambientColor: '#00D2FF' },
    { id: 'a', name: 'Alba.mp4', folderPath: '/USB/Videos', kind: 'video', formatLabel: '1080p MP4', sizeLabel: '2.5 GB', durationSec: 90, ambientColor: '#00D2FF' },
    { id: 'c', name: 'Brisa.mp4', folderPath: '/USB/Viajes', kind: 'video', formatLabel: '4K MP4', sizeLabel: '1.2 GB', durationSec: 300, ambientColor: '#00D2FF' },
  ];

  assert.equal(parseSizeToBytes(files[0]), 500 * 1024 * 1024);
  assert.equal(parseSizeToBytes(files[1]), 2.5 * 1024 * 1024 * 1024);

  assert.deepEqual(
    filterAndSortMedia(files, '', 'name-asc').map((f) => f.id),
    ['a', 'c', 'b']
  );
  assert.deepEqual(
    filterAndSortMedia(files, '', 'name-desc').map((f) => f.id),
    ['b', 'c', 'a']
  );
  assert.deepEqual(
    filterAndSortMedia(files, '', 'size-desc').map((f) => f.id),
    ['a', 'c', 'b']
  );
  assert.deepEqual(
    filterAndSortMedia(files, '', 'duration-desc').map((f) => f.id),
    ['c', 'b', 'a']
  );
  assert.deepEqual(
    filterAndSortMedia(files, '', 'format').map((f) => f.id),
    ['a', 'b', 'c']
  );
  assert.deepEqual(
    filterAndSortMedia(files, 'viajes', 'name-asc').map((f) => f.id),
    ['c']
  );
  assert.deepEqual(
    filterAndSortMedia(files, 'MKV', 'name-asc').map((f) => f.id),
    ['b']
  );
});

test('stepListIndex clamps cleanly at start and end of file list', () => {
  assert.equal(stepListIndex(0, 4, 'up'), 0);
  assert.equal(stepListIndex(0, 4, 'down'), 1);
  assert.equal(stepListIndex(3, 4, 'down'), 3);
  assert.equal(stepListIndex(2, 4, 'up'), 1);
});

test('stepSlideIndex wraps around forward and backward', () => {
  assert.equal(stepSlideIndex(0, 5, 'next'), 1);
  assert.equal(stepSlideIndex(4, 5, 'next'), 0);
  assert.equal(stepSlideIndex(0, 5, 'prev'), 4);
});

test('cycleTransitionMode cycles through all 6 transition options', () => {
  let mode = cycleTransitionMode('fade');
  assert.equal(mode, 'ken-burns');
  mode = cycleTransitionMode(mode);
  assert.equal(mode, 'slide');
  mode = cycleTransitionMode(mode);
  assert.equal(mode, 'blur');
  mode = cycleTransitionMode(mode);
  assert.equal(mode, 'zoom');
  mode = cycleTransitionMode(mode);
  assert.equal(mode, 'none');
  mode = cycleTransitionMode(mode);
  assert.equal(mode, 'fade');
});

test('getNextTrackIndex handles shuffle and wrap-around', () => {
  assert.equal(getNextTrackIndex(1, 3, 'next', true, () => 0.4), 2);
  assert.equal(getNextTrackIndex(0, 3, 'prev', false), 2);
});
