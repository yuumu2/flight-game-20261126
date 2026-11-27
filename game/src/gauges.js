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

const faceColor = '#0b0f13';
const rimColor = '#a7afb4';
const instrumentWhite = '#f3f5f5';
const green = '#55b56a';
const yellow = '#e9bf49';
const red = '#eb5353';

function drawBezel(ctx, cx, cy, radius) {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#202529';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 0.75, 0, Math.PI * 2);
  ctx.strokeStyle = rimColor;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawDrum(ctx, cx, cy, face, reading) {
  const digits = String(Math.round(reading));
  const width = Math.max(face * 0.88, digits.length * 5 + 4);
  const height = Math.max(9, face * 0.22);
  const y = cy - face * 0.22;
  ctx.fillStyle = '#040608';
  ctx.fillRect(cx - width / 2, y - height / 2, width, height);
  ctx.strokeStyle = '#636b72';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - width / 2, y - height / 2, width, height);
  text(ctx, digits, cx, y, instrumentWhite, 8, 'center');
}

export function drawGauge(ctx, cx, cy, radius, fraction, label, ticks, options = {}) {
  const { angleFor = dialAngle, arcs = [], redLine, drum } = options;
  const face = radius * 0.84;
  ctx.save();
  drawBezel(ctx, cx, cy, radius);
  ctx.beginPath();
  ctx.arc(cx, cy, face, 0, Math.PI * 2);
  ctx.fillStyle = faceColor;
  ctx.fill();

  for (const [start, end, color] of arcs) {
    ctx.beginPath();
    ctx.arc(cx, cy, face * 0.92, angleFor(start) - Math.PI / 2, angleFor(end) - Math.PI / 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, radius * 0.055);
    ctx.stroke();
  }

  ctx.lineWidth = 1;
  for (const tick of ticks) {
    const angle = angleFor(tick.fraction);
    const x = Math.sin(angle) * face;
    const y = -Math.cos(angle) * face;
    const inner = tick.label === null || drum !== undefined ? 0.77 : 0.71;
    line(ctx, cx + x * inner, cy + y * inner, cx + x * 0.87, cy + y * 0.87, instrumentWhite);
    if (tick.label !== null) {
      const labelRadius = drum === undefined ? 0.53 : 0.65;
      text(ctx, tick.label, cx + x * labelRadius, cy + y * labelRadius, instrumentWhite, 8, 'center');
    }
  }
  if (redLine !== undefined) {
    const angle = angleFor(redLine);
    const x = Math.sin(angle) * face;
    const y = -Math.cos(angle) * face;
    ctx.lineWidth = Math.max(1.5, radius * 0.06);
    line(ctx, cx + x * 0.76, cy + y * 0.76, cx + x * 0.99, cy + y * 0.99, red);
  }

  if (drum !== undefined) drawDrum(ctx, cx, cy, face, drum);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angleFor(THREE.MathUtils.clamp(fraction, 0, 1)));
  const shoulder = Math.max(1.15, face * 0.049);
  ctx.beginPath();
  ctx.moveTo(0, -face * 0.75);
  ctx.lineTo(shoulder, -face * 0.17);
  ctx.lineTo(shoulder, face * 0.16);
  ctx.lineTo(0, face * 0.23);
  ctx.lineTo(-shoulder, face * 0.16);
  ctx.lineTo(-shoulder, -face * 0.17);
  ctx.closePath();
  ctx.fillStyle = instrumentWhite;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.10, 0, Math.PI * 2);
  ctx.fillStyle = '#050608';
  ctx.fill();
  ctx.strokeStyle = rimColor;
  ctx.lineWidth = 1;
  ctx.stroke();
  text(ctx, label, cx, cy + radius * 0.42, instrumentWhite, 8, 'center');
  ctx.restore();
}

export function gaugeTicks(maximum, step, labelStep, labelUnit = 1) {
  return Array.from({ length: maximum / step + 1 }, (_, i) => {
    const value = i * step;
    return { fraction: value / maximum, label: value % labelStep === 0 ? String(value / labelUnit) : null };
  });
}

export function drawAttitude(ctx, flight, x, y, radius) {
  const face = radius * 0.86;
  ctx.save();
  drawBezel(ctx, x, y, radius);
  ctx.translate(x, y);

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, face, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = HUD.sky;
  ctx.fillRect(-face, -face, face * 2, face * 2);
  ctx.rotate(-flight.roll);
  const pitchScale = face * 2.35;
  const limit = face * 0.85;
  const horizon = THREE.MathUtils.clamp(flight.pitch * pitchScale, -limit, limit);
  ctx.fillStyle = HUD.ground;
  ctx.fillRect(-face * 2, horizon, face * 4, face * 4);
  ctx.lineWidth = 1.5;
  line(ctx, -face * 2, horizon, face * 2, horizon, instrumentWhite);
  for (const degrees of [-20, -10, 10, 20]) {
    const level = horizon + THREE.MathUtils.degToRad(degrees) * pitchScale;
    line(ctx, -face * 0.30, level, -face * 0.10, level, instrumentWhite);
    line(ctx, face * 0.10, level, face * 0.30, level, instrumentWhite);
  }
  ctx.restore();

  ctx.lineWidth = 1;
  for (const degrees of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
    const angle = THREE.MathUtils.degToRad(degrees);
    const tickX = Math.sin(angle) * face;
    const tickY = -Math.cos(angle) * face;
    const inner = degrees % 30 === 0 ? 0.81 : 0.87;
    line(ctx, tickX * inner, tickY * inner, tickX * 0.97, tickY * 0.97, instrumentWhite);
  }

  ctx.save();
  ctx.rotate(flight.roll);
  ctx.beginPath();
  ctx.moveTo(0, -face * 0.80);
  ctx.lineTo(face * 0.075, -face * 0.65);
  ctx.lineTo(-face * 0.075, -face * 0.65);
  ctx.closePath();
  ctx.fillStyle = instrumentWhite;
  ctx.fill();
  ctx.restore();

  ctx.lineWidth = Math.max(2, face * 0.065);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = amber;
  ctx.beginPath();
  for (const side of [-1, 1]) {
    ctx.moveTo(side * face * 0.53, 0);
    ctx.lineTo(side * face * 0.23, 0);
    ctx.lineTo(side * face * 0.13, face * 0.10);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1, face * 0.044), 0, Math.PI * 2);
  ctx.fillStyle = amber;
  ctx.fill();
  ctx.restore();
}

const speedTicks = gaugeTicks(160, 20, 40);
const altitudeTicks = gaugeTicks(3000, 250, 500, 100);
const vsiTicks = Array.from({ length: 9 }, (_, i) => ({
  fraction: i / 8,
  label: i % 2 === 0 ? String((i - 4) / 2) : null,
}));
const vsiAngle = (fraction) => THREE.MathUtils.degToRad(-225 + 270 * fraction);
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
    'SPD KT', speedTicks, {
      arcs: [[45 / 160, 115 / 160, green], [115 / 160, 140 / 160, yellow]],
      redLine: 140 / 160,
    });
  drawGauge(ctx, cx - 1.5 * spacing, cy, radius, altitude / 3000, 'ALT FT', altitudeTicks, { drum: altitude });
  drawAttitude(ctx, flight, cx - 0.5 * spacing, cy, radius);
  drawGauge(ctx, cx + 0.5 * spacing, cy, radius, vsiFraction(flight.verticalSpeed), 'VSI', vsiTicks, { angleFor: vsiAngle });
  drawGauge(ctx, cx + 1.5 * spacing, cy, radius, (600 + engineThrottle * 2100) / 3000,
    'RPM', rpmTicks, { arcs: [[1900 / 3000, 2600 / 3000, green]], redLine: 2600 / 3000 });
  drawGauge(ctx, cx + 2.5 * spacing, cy, radius, flight.fuel, 'FUEL', fuelTicks, { arcs: [[0, FUEL.lowFraction, red]] });
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
