// Draws flight instruments and next-target guidance on the overlay canvas.
import * as THREE from 'three';
import { COURSE, HUD, PALETTE, WATERLANE, VIEW, WORLD } from './config.js';
import { waterlaneCenter, waterlaneTangent } from './world.js';

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
  let staged = false;

  function setStaged(value) {
    staged = value;
  }

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
    panel(left, y, stripWidth, 54);
    ctx.save();
    ctx.beginPath();
    ctx.rect(left + 5, y, stripWidth - 10, 38);
    ctx.clip();
    const pixelsPerDegree = stripWidth / 115;
    for (let tick = Math.floor((degrees - 60) / tickSize) * tickSize; tick <= degrees + 60; tick += tickSize) {
      const x = center + (tick - degrees) * pixelsPerDegree;
      const value = wrapDegrees(tick);
      const label = cardinal[value] ?? (value % 30 === 0 ? value : '');
      line(x, y + 18, x, y + (label === '' ? 24 : 28), amber);
      if (label !== '') text(label, x, y + 11, cardinal[value] ? cyan : amber, 11, 'center');
    }
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(center - 4, y + 34);
    ctx.lineTo(center, y + 28);
    ctx.lineTo(center + 4, y + 34);
    ctx.closePath();
    ctx.fillStyle = cyan;
    ctx.fill();
    text(`HDG ${String(wrapDegrees(Math.round(degrees))).padStart(3, '0')}°`, center, y + 43, cyan, 13, 'center');
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
    const pitchScale = radius * 2.35;
    const limit = radius * 0.85;
    const horizon = THREE.MathUtils.clamp(flight.pitch * pitchScale, -limit, limit);
    ctx.fillStyle = HUD.ground;
    ctx.fillRect(-radius * 2, horizon, radius * 4, radius * 4);
    line(-radius * 2, horizon, radius * 2, horizon, amber);
    ctx.lineWidth = 2;
    for (const degrees of [-20, -10, 10, 20]) {
      const level = horizon + THREE.MathUtils.degToRad(degrees) * pitchScale;
      line(-radius * 0.30, level, -radius * 0.10, level, HUD.muted);
      line(radius * 0.10, level, radius * 0.30, level, HUD.muted);
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

  function radar(flight, course, position, x, y, radius) {
    const scale = 2 * radius / WORLD.size;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = HUD.panel;
    ctx.fill();
    ctx.clip();

    const laneX = waterlaneCenter.x * scale;
    const laneY = waterlaneCenter.z * scale;
    const halfLane = WATERLANE.length * scale / 2;
    const endX = waterlaneTangent.x * halfLane;
    const endY = waterlaneTangent.z * halfLane;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    line(laneX - endX, laneY - endY, laneX + endX, laneY + endY, cyan);

    const { nextIndex, finished, elapsed } = course.state;
    ctx.lineWidth = 1;
    course.ringPositions.forEach((ring, index) => {
      const passed = index < nextIndex;
      const active = index === nextIndex && !finished;
      const ringX = ring.x * scale;
      const ringY = ring.z * scale;
      const color = passed ? PALETTE.ringPassed : active ? PALETTE.ringNext : PALETTE.ring;
      ctx.beginPath();
      ctx.arc(ringX, ringY, passed ? 2 : active ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (active) {
        const pulseRadius = 5.5 + 1.5 * Math.sin(elapsed * 4.2);
        ctx.beginPath();
        ctx.arc(ringX, ringY, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.stroke();
      }
    });

    ctx.save();
    ctx.translate(position.x * scale, position.z * scale);
    ctx.rotate(flight.heading);
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(3, 4);
    ctx.lineTo(-3, 4);
    ctx.closePath();
    ctx.fillStyle = cyan;
    ctx.fill();
    line(0, -5, 0, -10, cyan);
    ctx.restore();
    text('N', 0, 9 - radius, HUD.muted, 9, 'center');
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = HUD.border;
    ctx.stroke();
    ctx.restore();
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
      const halfSize = 6.5;
      ctx.moveTo(x, y - halfSize);
      ctx.lineTo(x + halfSize, y);
      ctx.lineTo(x, y + halfSize);
      ctx.lineTo(x - halfSize, y);
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
    ctx.scale(0.8, 0.8);
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
    const leftEdge = margin + 10;
    const rightEdge = margin + panelWidth - 10;
    panel(margin, margin, panelWidth, 118);
    readout('ALT', `${numberFormat.format(Math.max(0, position.y) * HUD.feetPerMetre)} FT`,
      leftEdge, margin + 19, rightEdge, amber, size);
    readout('SPD', `${numberFormat.format(flight.speed * HUD.knotsPerMetreSecond)} KT`,
      leftEdge, margin + 46, rightEdge, cyan, size);
    const throttle = THREE.MathUtils.clamp(flight.throttle, 0, 1);
    readout('THR', `${Math.round(throttle * 100)}%`, leftEdge, margin + 73, rightEdge, cyan, size);
    const barWidth = rightEdge - leftEdge;
    ctx.fillStyle = HUD.border;
    ctx.fillRect(leftEdge, margin + 87, barWidth, 5);
    ctx.fillStyle = cyan;
    ctx.fillRect(leftEdge, margin + 87, barWidth * throttle, 5);
    if (flight.stallWarn) {
      text('STALL', leftEdge, margin + 105, '#ff5a4a', 11, 'left', true);
    }

    const right = width - margin - panelWidth;
    panel(right, margin, panelWidth, 105);
    readout('TIME', formatTime(course.state.elapsed), right + 10, margin + 20, width - margin - 10, amber, size);
    readout('SCORE', numberFormat.format(course.state.score), right + 10, margin + 52, width - margin - 10, cyan, size);
    const rings = course.state.ringsPassed;
    readout('RINGS', rings === COURSE.ringCount ? 'LAND' : `${rings}/${COURSE.ringCount}`,
      right + 10, margin + 84, width - margin - 10, amber, size);
    compass(flight.heading, compact ? margin + 125 : margin, Math.min(HUD.compassWidth, compact ? width - 2 * margin : width - 465));

    const x = width / 2;
    const y = height / 2;
    line(x - 10, y, x - 3, y, amber);
    line(x + 3, y, x + 10, y, amber);
    line(x, y - 7, x, y - 3, amber);
    line(x, y + 3, x, y + 7, amber);
    drawTarget(course.target, camera, position);
    attitude(flight, width * 0.37, height - (compact ? 74 : 88), compact ? 33 : 43);
    const radarRadius = compact ? 52 : 70;
    radar(flight, course, position, width - margin - radarRadius, height - margin - radarRadius, radarRadius);

    if (screen === 'paused') {
      ctx.fillStyle = HUD.shade;
      ctx.fillRect(0, 0, width, height);
      panel(x - 125, y - 37, 250, 74);
      text('PAUSED', x, y - 10, amber, 24, 'center');
      text('P / ESC TO RESUME', x, y + 17, cyan, 12, 'center');
    } else if (!staged && (flight.grounded || course.state.elapsed < 4)) {
      const controls = compact ? '↑↓ Pitch   ←→ Roll   W/S Throttle   P Pause'
        : '↑ / ↓ Pitch    ← / → or A / D Roll    W / S Throttle    P Pause';
      const hint = flight.grounded ? 'Hold W to accelerate, then ↑ to lift off' : controls;
      text(hint, margin, height - 21, HUD.muted, compact ? 10 : 12);
    }
  }

  return { draw, setStaged };
}
