// Boots the game and runs the fixed-step simulation and screen flow.
import * as THREE from 'three';
import { AIRCRAFT, BEST_KEY, COURSE, DEFAULT_SEED, RUNWAY, STEP, VIEW } from './config.js';
import { buildWorld, runwayCenter, runwayHeading, runwayTangent } from './world.js';
import { buildSeaplane, createFlight } from './aircraft.js';
import { createCourse, landingLabel } from './course.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createHud, formatTime } from './hud.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

const query = new URLSearchParams(window.location.search);
const seedParam = query.get('seed');
const parsedSeed = seedParam === null || seedParam.trim() === '' ? NaN : Number(seedParam);
const worldSeed = Number.isInteger(parsedSeed) && parsedSeed >= 0 && parsedSeed <= 0xffffffff
  ? parsedSeed : DEFAULT_SEED;
const shot = query.get('shot');

const title = document.querySelector('#title-screen');
const result = document.querySelector('#result-screen');
const breakdown = document.querySelector('#breakdown');
const status = document.querySelector('#status');
const scene = new THREE.Scene();
const world = buildWorld(scene, worldSeed);
const plane = buildSeaplane();
const flight = createFlight();
const course = createCourse(scene, world.heightAt, worldSeed);
const view = createRenderer(document.querySelector('#game'));
const hud = createHud(document.querySelector('#hud'));
const input = createInput();
scene.add(plane.group);

const spawn = runwayCenter.clone().addScaledVector(runwayTangent, RUNWAY.length / 2 - AIRCRAFT.spawnInset);
spawn.y = world.heightAt(spawn.x, spawn.z) + AIRCRAFT.groundClearance;
const numberFormat = new Intl.NumberFormat('en-US');
const orbitPosition = new THREE.Vector3();
const orbitTarget = new THREE.Vector3(0, 0, 0);
let screen = 'title';
let accumulator = 0;
let previousFrame;
let orbit = 0;

function show(nextScreen) {
  screen = nextScreen;
  title.hidden = screen !== 'title';
  result.hidden = screen !== 'over';
  const flightMessage = flight.state.grounded ? 'On the runway. Hold W to accelerate, then Up to take off.' : 'Flight in progress.';
  const resultMessage = flight.state.crashed ? 'Flight ended with a crash.' : 'Flight complete.';
  status.textContent = {
    title: 'Duskmail Atoll. Press Space or click to fly.',
    play: flightMessage,
    paused: 'Paused. Press P or Escape to resume.',
    over: `${resultMessage} Score ${course.state.score}. Press Space or click to fly again.`,
  }[screen];
}

function bestScore(score, staged) {
  try {
    const stored = Number(localStorage.getItem(BEST_KEY));
    const best = Math.max(Number.isFinite(stored) ? stored : 0, score);
    if (!staged) localStorage.setItem(BEST_KEY, String(best));
    return staged ? score : best;
  } catch {
    return score;
  }
}

function showResult(staged = false) {
  const run = course.state;
  const landing = flight.state.crashed ? 'Crash'
    : run.ringsPassed < COURSE.ringCount ? 'Course incomplete' : landingLabel(run.landingQuality);
  const fields = [
    ['Rings', `${run.ringsPassed} / ${COURSE.ringCount}`],
    ['Time', formatTime(run.elapsed)],
    ['Landing', landing],
    ['Time bonus', numberFormat.format(run.timeBonus)],
    ['Total', numberFormat.format(run.score)],
    ['Best', numberFormat.format(bestScore(run.score, staged))],
  ];
  const list = document.createElement('dl');
  for (const [label, value] of fields) {
    const term = document.createElement('dt');
    const detail = document.createElement('dd');
    term.textContent = label;
    detail.textContent = value;
    list.append(term, detail);
  }
  breakdown.replaceChildren(list);
  show('over');
}

function resetRun() {
  flight.reset(spawn, runwayHeading + Math.PI, true);
  course.reset(spawn);
  view.updateCamera(flight.state, 0, true);
  accumulator = 0;
}

function paint(dt) {
  const state = flight.state;
  plane.group.position.copy(state.position);
  plane.group.rotation.set(state.pitch, -state.heading, -state.roll, 'YXZ');
  plane.spinPropeller(dt, state.throttle);
  view.render(scene);
  hud.draw(state, course, screen, view.camera, state.position);
}

function frame(now) {
  const dt = previousFrame === undefined ? 0 : Math.min((now - previousFrame) / 1000, VIEW.maxFrame);
  previousFrame = now;
  const actions = input.takeActions();
  if ((screen === 'title' || screen === 'over') && (actions & ACTION_CONFIRM)) {
    resetRun();
    show('play');
  } else if ((actions & ACTION_PAUSE) && (screen === 'play' || screen === 'paused')) {
    accumulator = 0;
    show(screen === 'play' ? 'paused' : 'play');
  }

  if (screen === 'title') {
    orbit += dt * VIEW.orbitRate;
    orbitPosition.set(Math.cos(orbit) * VIEW.orbitRadius, VIEW.orbitHeight, Math.sin(orbit) * VIEW.orbitRadius);
    view.setShotCamera(orbitPosition, orbitTarget);
  } else if (screen === 'play') {
    accumulator += dt;
    while (accumulator >= STEP && !course.state.finished) {
      flight.step(STEP, input, world.heightAt);
      course.update(course.state, flight.state, STEP);
      accumulator -= STEP;
    }
    view.updateCamera(flight.state, dt);
    if (course.state.finished) showResult();
  }
  paint(screen === 'play' || screen === 'title' ? dt : 0);
  window.requestAnimationFrame(frame);
}

if (shot !== null) {
  window.__shotReady = false;
  const staged = stageShot(shot, { scene, flight, course, renderer: view });
  if (staged.screen === 'over') showResult(true);
  else show(staged.screen);
  let remaining = VIEW.shotFrames;
  function paintShot() {
    paint(STEP);
    remaining--;
    if (remaining > 0) window.requestAnimationFrame(paintShot);
    else window.__shotReady = true;
  }
  window.requestAnimationFrame(paintShot);
} else {
  resetRun();
  show('title');
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      previousFrame = undefined;
      accumulator = 0;
      show('paused');
    }
  });
  window.requestAnimationFrame(frame);
}
