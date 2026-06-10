'use strict';

const $ = (id) => document.getElementById(id);

function paint(s) {
  $('openAtLogin').classList.toggle('on', !!s.openAtLogin);
  $('showMiniOnLaunch').classList.toggle('on', !!s.showMiniPlayerOnLaunch);
  for (const seg of $('theme').querySelectorAll('.seg')) {
    seg.classList.toggle('active', seg.dataset.v === (s.theme || 'system'));
  }
  if (s.version) $('version').textContent = 'Version ' + s.version;
}

async function load() {
  paint(await window.settingsAPI.get());
}

// Toggles
$('openAtLogin').addEventListener('click', async () => {
  const on = !$('openAtLogin').classList.contains('on');
  paint(await window.settingsAPI.set({ openAtLogin: on }));
});
$('showMiniOnLaunch').addEventListener('click', async () => {
  const on = !$('showMiniOnLaunch').classList.contains('on');
  paint(await window.settingsAPI.set({ showMiniPlayerOnLaunch: on }));
});

// Theme segmented control
$('theme').addEventListener('click', async (e) => {
  const seg = e.target.closest('.seg');
  if (!seg) return;
  paint(await window.settingsAPI.set({ theme: seg.dataset.v }));
});

$('github').addEventListener('click', () => window.settingsAPI.openGitHub());

load();
