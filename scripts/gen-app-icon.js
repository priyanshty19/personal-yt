'use strict';

// Renders a 1024x1024 app icon (rounded-rect, red gradient, white music note)
// by drawing an SVG in an offscreen Electron window and capturing it to
// build/icon.png. Run via `electron scripts/gen-app-icon.js`.

const { app, BrowserWindow, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

const SIZE = 1024;
const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7B2FF7"/>
      <stop offset="1" stop-color="#2575FC"/>
    </linearGradient>
  </defs>
  <rect x="112" y="112" width="800" height="800" rx="180" ry="180" fill="url(#bg)"/>
  <!-- eighth note, white -->
  <g fill="#ffffff">
    <rect x="556" y="300" width="34" height="370"/>
    <path d="M590 300 q150 30 150 150 q0 -60 -150 -90 z"/>
    <ellipse cx="470" cy="672" rx="92" ry="70"/>
    <rect x="556" y="300" width="34" height="372"/>
  </g>
</svg>`;

const HTML =
  'data:text/html;charset=utf-8,' +
  encodeURIComponent(
    `<!doctype html><html><body style="margin:0;background:transparent">${SVG}</body></html>`
  );

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: false },
  });
  win.loadURL(HTML);
  win.webContents.on('did-finish-load', () => {
    setTimeout(async () => {
      let img = await win.webContents.capturePage();
      // Normalize to exactly 1024x1024 regardless of display scale factor.
      img = img.resize({ width: SIZE, height: SIZE });
      const out = path.join(__dirname, '..', 'build', 'icon.png');
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, img.toPNG());
      console.log('Wrote ' + out + ' ' + JSON.stringify(img.getSize()));
      app.quit();
    }, 600);
  });
});
