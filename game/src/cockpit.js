// Paints the instruments onto a live cockpit panel texture.
import * as THREE from 'three';
import { HUD, PALETTE } from './config.js';
import { drawAnnunciators, drawDigitalStrip, drawInstrumentRow } from './gauges.js';

const font = 'ui-monospace, Menlo, Consolas, monospace';

export function createCockpitTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  function text(value, x, y, size, color, align = 'left') {
    ctx.font = `600 ${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(value, x, y);
  }

  function draw(flight, position) {
    ctx.fillStyle = '#12161d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (const x of [340, 684]) ctx.fillRect(x, 0, 1, canvas.height);

    drawDigitalStrip(ctx, 512, 58, 30, flight, position);
    drawInstrumentRow(ctx, 512, 218, 74, flight, position);

    const throttle = THREE.MathUtils.clamp(flight.throttle, 0, 1);
    text('THR', 56, 408, 21, PALETTE.hudCyan);
    text(`${Math.round(throttle * 100)}%`, 480, 408, 21, PALETTE.hudCyan, 'right');
    ctx.fillStyle = HUD.border;
    ctx.fillRect(56, 428, 424, 10);
    ctx.fillStyle = PALETTE.hudCyan;
    ctx.fillRect(56, 428, 424 * throttle, 10);
    drawAnnunciators(ctx, 560, 402, flight, 2);
    text('DUSKMAIL', 968, 470, 16, HUD.muted, 'right');
    texture.needsUpdate = true;
  }

  return { texture, draw };
}
