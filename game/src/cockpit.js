// Paints the cockpit panel, navigation display, and checklist card.
import * as THREE from 'three';
import { COURSE, HUD, PALETTE, WATERLANE, WORLD } from './config.js';
import { drawAnnunciators, drawDigitalStrip, drawSixPack } from './gauges.js';
import { waterlaneCenter, waterlaneTangent } from './world.js';

const font = 'ui-monospace, Menlo, Consolas, monospace';
const panelInk = '#3a4147';
const amber = PALETTE.hudAmber;
const cyan = PALETTE.hudCyan;

function makeTexture(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { ctx: canvas.getContext('2d'), texture };
}

function text(ctx, value, x, y, size, color, align = 'left') {
  ctx.font = `600 ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

function inset(ctx, x, y, w, h, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 5);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function dot(ctx, x, y, radius, color) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function line(ctx, x, y, toX, toY, color) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(toX, toY);
  ctx.strokeStyle = color;
  ctx.stroke();
}

function drawZone(ctx, x, y, width, height) {
  inset(ctx, x, y, width, height, 'rgba(0,0,0,0.06)', 'rgba(30,34,38,0.35)');
  for (const screwX of [x + 8, x + width - 8]) {
    for (const screwY of [y + 8, y + height - 8]) {
      dot(ctx, screwX, screwY, 2.5, '#62695f');
      line(ctx, screwX - 1, screwY + 1, screwX + 1, screwY - 1, '#c0c5bb');
    }
  }
}

function drawPanelTrim(ctx) {
  ctx.strokeStyle = '#656c64';
  ctx.lineWidth = 2;
  ctx.strokeRect(3, 3, 1018, 506);
  ctx.strokeStyle = 'rgba(247,249,241,0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(6, 6, 1012, 500);
  for (const x of [10, 1014]) {
    for (const y of [10, 124, 256, 388, 502]) {
      dot(ctx, x, y, 3, '#565d56');
      line(ctx, x - 1.2, y + 0.8, x + 1.2, y - 0.8, '#bbc2b7');
    }
  }
}

function drawInstrumentPlacards(ctx) {
  const labels = ['AIRSPEED', 'ATTITUDE', 'ALTIMETER', 'VERTICAL SPEED', 'ENGINE RPM', 'FUEL'];
  labels.forEach((label, i) => {
    const x = 242 + (i % 3 - 1) * 63 * 2.36;
    const y = i < 3 ? 245 : 410;
    text(ctx, label, x, y, 11, panelInk, 'center');
  });
  text(ctx, 'POWER CONTROLS', 564, 306, 10, panelInk, 'center');
}

function drawQuadrant(ctx, throttle) {
  inset(ctx, 494, 88, 140, 208, '#14181d', '#4b5155');
  const levers = [
    [526, 'THROTTLE', throttle, '#101216'],
    [564, 'PROPELLER', 0.78, '#274b8f'],
    [602, 'MIXTURE', 0.9, '#a33327'],
  ];
  for (const [x, label, value, color] of levers) {
    inset(ctx, x - 5, 116, 10, 122, '#05070a', '#2c3138');
    const y = THREE.MathUtils.lerp(238, 116, value);
    inset(ctx, x - 14, y - 7.5, 28, 15, color, '#626a72');
    line(ctx, x - 8, y - 5, x + 8, y - 5, '#e7ebed');
    ctx.save();
    ctx.translate(x + 9, 263);
    ctx.rotate(-Math.PI / 2);
    text(ctx, label, 0, 0, 10, '#cfd6da', 'center');
    ctx.restore();
    dot(ctx, x, 330, 13, color);
    ctx.beginPath();
    ctx.arc(x, 330, 9.5, Math.PI * 1.08, Math.PI * 1.70);
    ctx.strokeStyle = '#b9bcb9';
    ctx.stroke();
  }
  inset(ctx, 494, 356, 140, 46, '#10151c');
  text(ctx, `THR ${Math.round(throttle * 100)}%`, 564, 379, 22, amber, 'center');
}

function drawCockpitRadar(ctx, cx, cy, radius, flight, course, position) {
  const scale = 2 * radius / WORLD.size;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.clip();
  if (course) {
    for (const range of [radius * 0.5, radius - 0.5]) {
      ctx.beginPath();
      ctx.arc(0, 0, range, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(127,231,255,0.22)';
      ctx.stroke();
    }
  }
  const laneX = waterlaneCenter.x * scale;
  const laneY = waterlaneCenter.z * scale;
  const laneHalf = WATERLANE.length * scale / 2;
  const dx = waterlaneTangent.x * laneHalf;
  const dy = waterlaneTangent.z * laneHalf;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  line(ctx, laneX - dx, laneY - dy, laneX + dx, laneY + dy, cyan);
  ctx.lineWidth = 1;

  if (course) {
    const { nextIndex, elapsed, finished } = course.state;
    course.ringPositions.forEach((ring, index) => {
      const passed = index < nextIndex;
      const next = index === nextIndex && !finished;
      const color = passed ? PALETTE.ringPassed : next ? PALETTE.ringNext : PALETTE.ring;
      const x = ring.x * scale;
      const y = ring.z * scale;
      dot(ctx, x, y, passed ? 2 : next ? 4 : 2.5, color);
      if (next) {
        ctx.beginPath();
        ctx.arc(x, y, 5.5 + 1.5 * Math.sin(elapsed * 4.2), 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.stroke();
      }
    });
    text(ctx, 'N', 0, 11 - radius, 10, HUD.muted, 'center');
  }

  ctx.translate(course ? position.x * scale : 0, course ? position.z * scale : 0);
  ctx.rotate(flight.heading);
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4, 5);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fillStyle = cyan;
  ctx.fill();
  ctx.restore();
}

function drawCard(ctx, course, position) {
  const next = course && course.state.nextIndex < COURSE.ringCount;
  ctx.fillStyle = '#f4ecd8';
  ctx.fillRect(0, 0, 512, 192);
  ctx.strokeStyle = '#51493a';
  ctx.strokeRect(3, 3, 506, 186);
  text(ctx, 'DUSKMAIL — CHECKLIST', 256, 26, 19, '#33312a', 'center');
  line(ctx, 20, 44, 492, 44, '#85765f');
  const title = !course ? 'MAIL RUN' : next ? `RING ${course.state.nextIndex + 1} OF ${COURSE.ringCount}` : 'LAND ON WATER LANE';
  const detail = !course ? 'DUSKMAIL ATOLL' : next
    ? `NEXT GATE · ${Math.round(position.distanceTo(course.target))} M` : 'WATER LANE AHEAD';
  text(ctx, title, 256, 80, course && !next ? 34 : 42, '#33312a', 'center');
  text(ctx, detail, 256, 122, 24, '#51493a', 'center');
  const passed = course?.state.nextIndex ?? 0;
  for (let i = 0; i < COURSE.ringCount; i++) {
    const x = 256 + (i - (COURSE.ringCount - 1) / 2) * 28;
    if (i < passed) dot(ctx, x, 158, 7, '#33312a');
    else if (next && i === passed) dot(ctx, x, 158, 7, PALETTE.ringNext);
    else {
      ctx.beginPath();
      ctx.arc(x, 158, 7, 0, Math.PI * 2);
      ctx.strokeStyle = '#51493a';
      ctx.stroke();
    }
  }
}

export function createCockpitTexture() {
  const { ctx, texture } = makeTexture(1024, 512);
  const { ctx: card, texture: cardTexture } = makeTexture(512, 192);
  const panel = ctx.createLinearGradient(0, 0, 0, 512);
  panel.addColorStop(0, '#a6aba1');
  panel.addColorStop(1, '#969c92');

  function draw(flight, position, course) {
    ctx.fillStyle = panel;
    ctx.fillRect(0, 0, 1024, 512);
    drawPanelTrim(ctx);
    drawZone(ctx, 16, 64, 452, 364);
    drawZone(ctx, 484, 64, 160, 364);
    drawZone(ctx, 660, 64, 348, 364);
    inset(ctx, 30, 8, 424, 44, '#10151c');
    drawDigitalStrip(ctx, 242, 30, 19, flight, position);
    drawAnnunciators(ctx, 470, 13, flight, 1.5);
    text(ctx, 'DUSKMAIL', 1000, 30, 15, panelInk, 'right');
    drawSixPack(ctx, 242, 246, 63, flight, position);

    const throttle = THREE.MathUtils.clamp(flight.throttle, 0, 1);
    drawQuadrant(ctx, throttle);
    drawInstrumentPlacards(ctx);
    inset(ctx, 676, 80, 316, 246, '#14181d');
    inset(ctx, 688, 92, 292, 222, '#0a141c');
    drawCockpitRadar(ctx, 834, 203, 98, flight, course, position);
    inset(ctx, 676, 340, 316, 36, '#14181d');
    inset(ctx, 676, 384, 316, 36, '#14181d');
    text(ctx, 'COM1 122.800', 690, 358, 15, '#7dff9a');
    text(ctx, 'NAV1 110.300', 842, 358, 15, '#7dff9a');
    text(ctx, 'XPNDR 1200', 690, 402, 15, amber);
    text(ctx, 'ADF 340', 842, 402, 15, '#7dff9a');

    text(ctx, 'DUSKMAIL ATOLL — SUNSET MAIL RUN', 724, 470, 13, panelInk, 'center');

    drawCard(card, course, position);
    texture.needsUpdate = true;
    cardTexture.needsUpdate = true;
  }

  return { texture, cardTexture, draw };
}
