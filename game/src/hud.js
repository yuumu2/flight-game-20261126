// Draws flight instruments and next-target guidance on the overlay canvas.
import * as THREE from 'three';
import { COURSE, HUD, PALETTE, VIEW } from './config.js';

const amber = PALETTE.hudAmber;
const cyan = PALETTE.hudCyan;
const font = 'ui-monospace, Menlo, Consolas, monospace';
const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const wrapDegrees = (angle) => ((angle % 360) + 360) % 360;

export function formatTime(seconds) {
  const whole = Math.floor(seconds);
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');
  const viewTarget = new THREE.Vector3();
  const projected = new THREE.Vector3();
  let width;
  let height;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, VIEW.pixelRatio);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  function panel(x, y, w, h) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 9);
    ctx.fillStyle = HUD.panel;
    ctx.fill();
    ctx.strokeStyle = HUD.border;
    ctx.stroke();
  }

  function text(value, x, y, color, size = 12, align = 'left', glow = false) {
    ctx.font = `600 ${size}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = glow ? 8 : 0;
    ctx.fillText(value, x, y);
    ctx.shadowBlur = 0;
  }

  function line(x1, y1, x2, y2, color) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  function readout(label, digits, x, y, edges, color, size) {
    text(label, x, y, color, 11);
    text(digits, edges, y, color, size, 'right', true);
  }

  function compass(heading, y, stripWidth) {
    const center = width / 2;
    const left = center - stripWidth / 2;
    const degrees = wrapDegrees(THREE.MathUtils.radToDeg(heading));
    const tickSize = HUD.tickDegrees;
    const cardinal = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
    panel(left, y, stripWidth, 63);
    ctx.save();
    ctx.beginPath();
    ctx.rect(left + 5, y, stripWidth - 10, 49);
    ctx.clip();
    const pixelsPerDegree = stripWidth / 115;
    for (let tick = Math.floor((degrees - 60) / tickSize) * tickSize; tick <= degrees + 60; tick += tickSize) {
      const x = center + (tick - degrees) * pixelsPerDegree;
      const value = wrapDegrees(tick);
      const label = cardinal[value] ?? (value % 30 === 0 ? value : '');
      line(x, y + 21, x, y + (label === '' ? 28 : 33), amber);
      if (label !== '') text(label, x, y + 13, cardinal[value] ? cyan : amber, 11, 'center');
    }
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(center - 4, y + 39);
    ctx.lineTo(center, y + 32);
    ctx.lineTo(center + 4, y + 39);
    ctx.closePath();
    ctx.fillStyle = cyan;
    ctx.fill();
    text(`HDG ${String(wrapDegrees(Math.round(degrees))).padStart(3, '0')}°`, center, y + 50, cyan, 13, 'center');
  }

  function attitude(flight, x, y, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = HUD.sky;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.translate(x, y);
    ctx.rotate(-flight.roll);
    const horizon = flight.pitch * radius * 2.35;
    ctx.fillStyle = HUD.ground;
    ctx.fillRect(-radius * 2, horizon, radius * 4, radius * 4);
    line(-radius * 2, horizon, radius * 2, horizon, amber);
    for (const offset of [-0.45, -0.23, 0.23, 0.45]) {
      line(-radius * 0.24, horizon + offset * radius, radius * 0.24, horizon + offset * radius, HUD.muted);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = amber;
    ctx.stroke();
    line(x - 17, y, x - 5, y, cyan);
    line(x + 5, y, x + 17, y, cyan);
    ctx.fillStyle = cyan;
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }

  function drawTarget(target, camera, position) {
    if (!target || !camera) return;
    viewTarget.copy(target).applyMatrix4(camera.matrixWorldInverse);
    projected.copy(target).project(camera);
    const margin = 30;
    const spanX = Math.max(1, width / 2 - margin);
    const spanY = Math.max(1, height / 2 - margin - 41);
    const cx = width / 2;
    const cy = height / 2 + 20;
    const sx = projected.x * width / 2;
    const sy = -projected.y * height / 2;
    const ahead = viewTarget.z < 0;

    if (ahead && Math.abs(sx) < spanX && Math.abs(sy - 20) < spanY) {
      const x = cx + sx;
      const y = height / 2 + sy;
      ctx.beginPath();
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x + 8, y);
      ctx.lineTo(x, y + 8);
      ctx.lineTo(x - 8, y);
      ctx.closePath();
      ctx.strokeStyle = cyan;
      ctx.stroke();
      text(`${numberFormat.format(position.distanceTo(target))} m`, x, y + 20, cyan, 12, 'center', true);
      return;
    }

    const dx = viewTarget.x || (Math.abs(viewTarget.y) < 0.001 ? 1 : 0);
    const dy = -viewTarget.y;
    const scale = 1 / Math.max(Math.abs(dx) / spanX, Math.abs(dy) / spanY);
    ctx.save();
    ctx.translate(cx + dx * scale, cy + dy * scale);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-7, -6);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-7, 6);
    ctx.closePath();
    ctx.fillStyle = cyan;
    ctx.fill();
    ctx.restore();
  }

  function draw(flight, course, screen, camera, position = flight.position) {
    ctx.clearRect(0, 0, width, height);
    if (screen !== 'play' && screen !== 'paused') {
      ctx.fillStyle = HUD.shade;
      ctx.fillRect(0, 0, width, height);
      return;
    }

    const compact = width < 720;
    const margin = compact ? 9 : 20;
    const panelWidth = compact ? Math.min(170, width / 2 - margin * 1.5) : 207;
    const size = compact ? 18 : 26;
    panel(margin, margin, panelWidth, 80);
    readout('ALT', `${numberFormat.format(Math.max(0, position.y) * HUD.feetPerMetre)} FT`,
      margin + 10, margin + 22, margin + panelWidth - 10, amber, size);
    readout('SPD', `${numberFormat.format(flight.speed * HUD.knotsPerMetreSecond)} KT`,
      margin + 10, margin + 57, margin + panelWidth - 10, cyan, size);

    const right = width - margin - panelWidth;
    panel(right, margin, panelWidth, 105);
    readout('TIME', formatTime(course.state.elapsed), right + 10, margin + 20, width - margin - 10, amber, size);
    readout('SCORE', numberFormat.format(course.state.score), right + 10, margin + 52, width - margin - 10, cyan, size);
    const rings = course.state.ringsPassed;
    readout('RINGS', rings === COURSE.ringCount ? 'LAND' : `${rings}/${COURSE.ringCount}`,
      right + 10, margin + 84, width - margin - 10, amber, size);
    compass(flight.heading, compact ? margin + 112 : margin, Math.min(HUD.compassWidth, compact ? width - 2 * margin : width - 465));

    const x = width / 2;
    const y = height / 2;
    line(x - 10, y, x - 3, y, amber);
    line(x + 3, y, x + 10, y, amber);
    line(x, y - 7, x, y - 3, amber);
    line(x, y + 3, x, y + 7, amber);
    drawTarget(course.target, camera, position);
    attitude(flight, width * 0.37, height - (compact ? 74 : 88), compact ? 33 : 43);

    if (screen === 'paused') {
      ctx.fillStyle = HUD.shade;
      ctx.fillRect(0, 0, width, height);
      panel(x - 125, y - 37, 250, 74);
      text('PAUSED', x, y - 10, amber, 24, 'center');
      text('P / ESC TO RESUME', x, y + 17, cyan, 12, 'center');
    } else {
      const controls = compact ? '↑↓ Pitch   ←→ Roll   W/S Throttle   P Pause'
        : '↑ / ↓ Pitch    ← / → or A / D Roll    W / S Throttle    P Pause';
      const hint = flight.grounded ? 'Hold W to accelerate, then ↑ to lift off' : controls;
      text(hint, margin, height - 21, HUD.muted, compact ? 10 : 12);
    }
  }

  return { draw };
}
