// Draws the shared round instruments for the HUD and cockpit panel.
import * as THREE from 'three';
import { FUEL, HUD, PALETTE } from './config.js';

const amber = PALETTE.hudAmber;
const cyan = PALETTE.hudCyan;
const font = 'ui-monospace, Menlo, Consolas, monospace';
const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function text(ctx, value, x, y, color, size, align, glow = false) {
  ctx.font = `600 ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow ? 8 : 0;
  ctx.fillText(value, x, y);
  ctx.shadowBlur = 0;
}

function line(ctx, x1, y1, x2, y2, color) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.stroke();
}

function dialAngle(fraction) {
  return THREE.MathUtils.degToRad(-135 + 270 * fraction);
}

export function drawGauge(ctx, cx, cy, radius, fraction, label, ticks, { redStart, redEnd } = {}) {
  const face = radius * 0.84;
  const dark = '#26303a';
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#0b0f16';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
  ctx.strokeStyle = amber;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, face, 0, Math.PI * 2);
  ctx.fillStyle = '#f3e9d2';
  ctx.fill();

  if (redStart !== undefined || redEnd !== undefined) {
    ctx.beginPath();
    ctx.arc(cx, cy, face * 0.86, dialAngle(redStart ?? 0) - Math.PI / 2,
      dialAngle(redEnd ?? 1) - Math.PI / 2);
    ctx.strokeStyle = '#c23b31';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  ctx.lineWidth = 1;
  for (const tick of ticks) {
    const angle = dialAngle(tick.fraction);
    const x = Math.sin(angle) * face;
    const y = -Math.cos(angle) * face;
    line(ctx, cx + x * 0.78, cy + y * 0.78, cx + x * 0.92, cy + y * 0.92, dark);
    if (tick.label !== null) text(ctx, tick.label, cx + x * 0.60, cy + y * 0.60, dark, 8, 'center');
  }

  const angle = dialAngle(THREE.MathUtils.clamp(fraction, 0, 1));
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  line(ctx, cx, cy, cx + Math.sin(angle) * face * 0.74, cy - Math.cos(angle) * face * 0.74, '#d35400');
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.10, 0, Math.PI * 2);
  ctx.fillStyle = dark;
  ctx.fill();
  text(ctx, label, cx, cy + radius * 0.42, dark, 8, 'center');
  ctx.restore();
}

export function gaugeTicks(maximum, step, labelStep, labelUnit = 1) {
  return Array.from({ length: maximum / step + 1 }, (_, i) => {
    const value = i * step;
    return { fraction: value / maximum, label: value % labelStep === 0 ? String(value / labelUnit) : null };
  });
}

export function drawAttitude(ctx, flight, x, y, radius) {
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
  line(ctx, -radius * 2, horizon, radius * 2, horizon, amber);
  ctx.lineWidth = 2;
  for (const degrees of [-20, -10, 10, 20]) {
    const level = horizon + THREE.MathUtils.degToRad(degrees) * pitchScale;
    line(ctx, -radius * 0.30, level, -radius * 0.10, level, HUD.muted);
    line(ctx, radius * 0.10, level, radius * 0.30, level, HUD.muted);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = amber;
  ctx.stroke();
  line(ctx, x - 17, y, x - 5, y, cyan);
  line(ctx, x + 5, y, x + 17, y, cyan);
  ctx.fillStyle = cyan;
  ctx.fillRect(x - 1, y - 1, 2, 2);
}

const speedTicks = gaugeTicks(160, 20, 40);
const altitudeTicks = gaugeTicks(3000, 250, 500, 100);
const vsiTicks = [
  { fraction: 0, label: '-2' }, { fraction: 0.25, label: '-1' }, { fraction: 0.5, label: '0' },
  { fraction: 0.75, label: '1' }, { fraction: 1, label: '2' },
];
const rpmTicks = gaugeTicks(3000, 500, 1000, 1000);
const fuelTicks = [
  { fraction: 0, label: 'E' }, { fraction: 0.25, label: null }, { fraction: 0.5, label: '1/2' },
  { fraction: 0.75, label: null }, { fraction: 1, label: 'F' },
];

export function vsiFraction(verticalSpeed) {
  return THREE.MathUtils.clamp((verticalSpeed * 196.85 + 2000) / 4000, 0, 1);
}

export function drawInstrumentRow(ctx, cx, cy, radius, flight, position) {
  const spacing = radius * 2.36;
  const speed = flight.speed * HUD.knotsPerMetreSecond;
  const altitude = Math.max(0, position.y) * HUD.feetPerMetre;
  const engineThrottle = flight.engineThrottle ?? flight.throttle;
  drawGauge(ctx, cx - 2.5 * spacing, cy, radius, speed / 160,
    'SPD KT', speedTicks, { redStart: 130 / 160 });
  drawGauge(ctx, cx - 1.5 * spacing, cy, radius, altitude / 3000, 'ALT FT', altitudeTicks);
  drawAttitude(ctx, flight, cx - 0.5 * spacing, cy, radius);
  drawGauge(ctx, cx + 0.5 * spacing, cy, radius, vsiFraction(flight.verticalSpeed), 'VSI', vsiTicks);
  drawGauge(ctx, cx + 1.5 * spacing, cy, radius, (600 + engineThrottle * 2100) / 3000,
    'RPM', rpmTicks, { redStart: 2600 / 3000 });
  drawGauge(ctx, cx + 2.5 * spacing, cy, radius, flight.fuel, 'FUEL', fuelTicks, { redEnd: FUEL.lowFraction });
}

export function drawDigitalStrip(ctx, cx, y, size, flight, position) {
  const altitude = numberFormat.format(Math.max(0, position.y) * HUD.feetPerMetre);
  const speed = numberFormat.format(flight.speed * HUD.knotsPerMetreSecond);
  const degrees = Math.round(THREE.MathUtils.radToDeg(flight.heading));
  const heading = String((degrees % 360 + 360) % 360).padStart(3, '0');
  const readouts = [
    ['ALT', `${altitude} FT`, amber],
    ['SPD', `${speed} KT`, cyan],
    ['HDG', `${heading}°`, cyan],
  ];
  const labelSize = Math.round(size * 0.65);
  const labelGap = size * 0.45;
  const gap = size * 1.65;
  ctx.save();
  const measured = readouts.map(([label, value, color]) => {
    ctx.font = `600 ${labelSize}px ${font}`;
    const valueOffset = ctx.measureText(label).width + labelGap;
    ctx.font = `600 ${size}px ${font}`;
    return { label, value, color, valueOffset, width: valueOffset + ctx.measureText(value).width };
  });
  const totalWidth = measured.reduce((sum, readout) => sum + readout.width, gap * (measured.length - 1));
  let x = cx - totalWidth / 2;
  for (const readout of measured) {
    text(ctx, readout.label, x, y, HUD.muted, labelSize, 'left');
    text(ctx, readout.value, x + readout.valueOffset, y, readout.color, size, 'left', true);
    x += readout.width + gap;
  }
  ctx.restore();
}

export function drawAnnunciators(ctx, x, y, flight, chipScale = 1) {
  const width = 74 * chipScale;
  const height = 19 * chipScale;
  const gap = 8 * chipScale;
  const chips = [
    ['STALL', flight.stallWarn && '#e5484d', '#fff5f2'],
    [flight.flameout ? 'FUEL EMPTY' : 'FUEL LOW',
      flight.flameout ? '#e5484d' : flight.fuel < FUEL.lowFraction && '#f5a623',
      flight.flameout ? '#fff5f2' : '#1d1503'],
  ];
  ctx.save();
  chips.forEach(([label, lit, litText], i) => {
    const left = x + i * (width + gap);
    ctx.beginPath();
    ctx.roundRect(left, y, width, height, 4 * chipScale);
    ctx.fillStyle = lit || 'rgba(10,14,20,0.55)';
    ctx.fill();
    if (!lit) {
      ctx.strokeStyle = HUD.border;
      ctx.stroke();
    }
    text(ctx, label, left + width / 2, y + height / 2,
      lit ? litText : 'rgba(208,220,224,0.6)', 10 * chipScale, 'center');
  });
  ctx.restore();
  return chips.length * width + (chips.length - 1) * gap;
}
