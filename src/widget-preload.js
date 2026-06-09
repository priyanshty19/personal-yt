'use strict';

// Bridge for the floating mini-player window. Exposes a tiny, safe API to the
// widget's renderer (contextIsolation is on, so no direct Node access there).

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('widget', {
  // Subscribe to metadata (title/artist/artwork/isPlaying) updates.
  onState: (cb) => ipcRenderer.on('state', (_e, s) => cb(s)),
  // Subscribe to playback progress updates.
  onProgress: (cb) => ipcRenderer.on('progress', (_e, p) => cb(p)),
  // Send a playback command back to the main YT Music window.
  command: (name, arg) => ipcRenderer.send('widget-command', name, arg),
  // Hide the mini-player.
  close: () => ipcRenderer.send('widget-close'),
});
