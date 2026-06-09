'use strict';

// This script runs inside the YouTube Music page with access to its DOM.
// It does two things:
//   1. Reports the current track + play state up to the main process.
//   2. Executes playback commands sent down from the main process by driving
//      YT Music's own <video> element / control buttons.
//
// We deliberately avoid any private API. `navigator.mediaSession` is populated
// by YT Music itself and is far more stable than scraping the DOM, with the
// <video> element as the source of truth for play/pause.

const { ipcRenderer } = require('electron');

function getVideo() {
  return document.querySelector('video');
}

// --- Reading state ----------------------------------------------------------

// Pick the highest-resolution artwork URL from the mediaSession metadata.
function bestArtwork(meta) {
  if (!meta || !meta.artwork || !meta.artwork.length) return '';
  let best = meta.artwork[0];
  let bestArea = 0;
  for (const a of meta.artwork) {
    const [w] = (a.sizes || '0x0').split('x').map(Number);
    const area = (w || 0) * (w || 0);
    if (area >= bestArea) {
      bestArea = area;
      best = a;
    }
  }
  return best.src || '';
}

let last = { title: null, artist: null, isPlaying: null, artwork: null };

function readState() {
  const video = getVideo();
  const meta = navigator.mediaSession && navigator.mediaSession.metadata;

  const title = meta ? meta.title : '';
  const artist = meta ? meta.artist : '';
  const artwork = bestArtwork(meta);
  // A track is "playing" when the <video> exists and is not paused.
  const isPlaying = !!(video && !video.paused && !video.ended);

  if (
    title !== last.title ||
    artist !== last.artist ||
    isPlaying !== last.isPlaying ||
    artwork !== last.artwork
  ) {
    last = { title, artist, isPlaying, artwork };
    ipcRenderer.send('track-update', { title, artist, isPlaying, artwork });
  }

  // Progress is sent separately (and more often) so it doesn't churn the tray.
  if (video && video.duration) {
    ipcRenderer.send('progress-update', {
      currentTime: video.currentTime,
      duration: video.duration,
    });
  }
}

// --- Executing commands -----------------------------------------------------

function click(selector) {
  const el = document.querySelector(selector);
  if (el) el.click();
  return !!el;
}

const commands = {
  playPause() {
    const video = getVideo();
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  },
  play() {
    const video = getVideo();
    if (video) video.play();
  },
  pause() {
    const video = getVideo();
    if (video) video.pause();
  },
  next() {
    // YT Music's player bar "next" button.
    click('.next-button') || click('tp-yt-paper-icon-button.next-button');
  },
  previous() {
    click('.previous-button') ||
      click('tp-yt-paper-icon-button.previous-button');
  },
  // Seek to a fraction (0..1) of the current track's duration.
  seek(fraction) {
    const video = getVideo();
    if (video && video.duration) video.currentTime = fraction * video.duration;
  },
};

ipcRenderer.on('command', (_e, command, arg) => {
  const fn = commands[command];
  if (fn) fn(arg);
  // Report the resulting state promptly so the tray label stays in sync.
  setTimeout(readState, 150);
});

// --- Boot -------------------------------------------------------------------

window.addEventListener('DOMContentLoaded', () => {
  // Poll for changes; YT Music is an SPA so there's no reload to hook.
  setInterval(readState, 500);
  readState();
});
