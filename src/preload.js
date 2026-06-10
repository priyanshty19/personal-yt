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

// YouTube Music can have several <video> elements (the main player plus
// preview/hover/ad players). Grabbing the first one gives wrong progress, so
// pick the one that's actually playing — else the longest (the main track).
function getVideo() {
  const vids = Array.from(document.querySelectorAll('video'));
  if (vids.length <= 1) return vids[0] || null;
  const playing = vids.find((v) => !v.paused && !v.ended && v.currentTime > 0);
  if (playing) return playing;
  return vids.reduce((a, b) => ((b.duration || 0) > (a.duration || 0) ? b : a));
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

// The player-bar like button renderer; carries a `like-status` attribute.
function likeRenderer() {
  return document.querySelector(
    'ytmusic-player-bar ytmusic-like-button-renderer'
  );
}

function isLiked() {
  const r = likeRenderer();
  return !!r && r.getAttribute('like-status') === 'LIKE';
}

let last = {
  title: null,
  artist: null,
  isPlaying: null,
  artwork: null,
  liked: null,
};

function readState() {
  const video = getVideo();
  const meta = navigator.mediaSession && navigator.mediaSession.metadata;

  const title = meta ? meta.title : '';
  const artist = meta ? meta.artist : '';
  const artwork = bestArtwork(meta);
  const liked = isLiked();
  // A track is "playing" when the <video> exists and is not paused.
  const isPlaying = !!(video && !video.paused && !video.ended);

  if (
    title !== last.title ||
    artist !== last.artist ||
    isPlaying !== last.isPlaying ||
    artwork !== last.artwork ||
    liked !== last.liked
  ) {
    last = { title, artist, isPlaying, artwork, liked };
    ipcRenderer.send('track-update', {
      title,
      artist,
      isPlaying,
      artwork,
      liked,
    });
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
  // Thumbs-up the current track via YT Music's own like button.
  like() {
    const r = likeRenderer();
    if (!r) return;
    const btn =
      r.querySelector('#button-shape-like button') ||
      r.querySelector('button[aria-label*="like" i]') ||
      r.querySelector('.like');
    if (btn) btn.click();
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
