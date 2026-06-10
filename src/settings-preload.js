'use strict';

// Safe bridge for the Settings window (contextIsolation on).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsAPI', {
  get: () => ipcRenderer.invoke('settings:get'),
  set: (patch) => ipcRenderer.invoke('settings:set', patch),
  openGitHub: () => ipcRenderer.send('settings:openGitHub'),
});
