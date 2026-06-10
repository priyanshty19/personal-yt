'use strict';

const $ = (id) => document.getElementById(id);
const PLAY = 'M8 5v14l11-7z';
const PAUSE = 'M6 5h4v14H6zm8 0h4v14h-4z';

let isPlaying = false;

// --- Incoming state ---------------------------------------------------------

window.widget.onState((s) => {
  $('title').textContent = s.title || 'Not playing';
  $('artist').textContent = s.artist || '';
  if (s.artwork) {
    $('art').src = s.artwork;
    $('art').style.visibility = 'visible';
  } else {
    $('art').removeAttribute('src');
  }
  isPlaying = !!s.isPlaying;
  $('playIcon').setAttribute('d', isPlaying ? PAUSE : PLAY);
  $('like').classList.toggle('liked', !!s.liked);
});

window.widget.onProgress((p) => {
  const pct = p.duration ? Math.min(100, (p.currentTime / p.duration) * 100) : 0;
  $('fill').style.width = pct + '%';
  $('knob').style.left = pct + '%';
});

// --- Outgoing commands ------------------------------------------------------

$('play').addEventListener('click', () => window.widget.command('playPause'));
$('next').addEventListener('click', () => window.widget.command('next'));
$('prev').addEventListener('click', () => window.widget.command('previous'));
$('like').addEventListener('click', () => window.widget.command('like'));
$('close').addEventListener('click', () => window.widget.close());

// Click anywhere on the progress bar to seek.
$('bar').addEventListener('click', (e) => {
  const rect = $('bar').getBoundingClientRect();
  const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  window.widget.command('seek', fraction);
});
