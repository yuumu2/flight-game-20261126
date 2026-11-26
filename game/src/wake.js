// Draws water wake, pooled float spray, and wingtip trails.
import * as THREE from 'three';
import { PALETTE, TRAILS, WORLD, WORLD_SEED } from './config.js';
import { createRandom } from './random.js';

const ribbonPairs = 48;
const ribbonInterval = 0.055;
const ribbonLife = 3.5;
const particleCount = 420;
const parkedY = -50;
let sprayMap;

function sprayTexture() {
  if (!sprayMap) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.85)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    sprayMap = new THREE.CanvasTexture(canvas);
  }
  return sprayMap;
}

export function createWake(scene, seed = WORLD_SEED) {
  let random = createRandom(seed + 73);
  const ribbonPositions = new Float32Array(ribbonPairs * 6);
  const ribbonColors = new Float32Array(ribbonPositions.length);
  const ribbonGeometry = new THREE.BufferGeometry();
  const indices = [];
  for (let pair = 0; pair < ribbonPairs - 1; pair++) {
    const i = pair * 2;
    indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
  }
  const ribbonPosition = new THREE.BufferAttribute(ribbonPositions, 3).setUsage(THREE.DynamicDrawUsage);
  const ribbonColor = new THREE.BufferAttribute(ribbonColors, 3).setUsage(THREE.DynamicDrawUsage);
  ribbonGeometry.setAttribute('position', ribbonPosition);
  ribbonGeometry.setAttribute('color', ribbonColor);
  ribbonGeometry.setIndex(indices);
  const ribbon = new THREE.Mesh(ribbonGeometry, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide,
  }));
  ribbon.name = 'Float wake';
  ribbon.frustumCulled = false;
  scene.add(ribbon);

  const sprayPositions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(sprayPositions.length);
  const life = new Float32Array(particleCount);
  const sprayPosition = new THREE.BufferAttribute(sprayPositions, 3).setUsage(THREE.DynamicDrawUsage);
  const sprayGeometry = new THREE.BufferGeometry();
  sprayGeometry.setAttribute('position', sprayPosition);
  const spray = new THREE.Points(sprayGeometry, new THREE.PointsMaterial({
    color: '#eaf6ff', map: sprayTexture(), size: 1.5, sizeAttenuation: true,
    transparent: true, opacity: 0.75, depthWrite: false, alphaTest: 0.02,
  }));
  spray.name = 'Float spray';
  spray.frustumCulled = false;
  scene.add(spray);

  const sternFoam = new THREE.Color('#eef7f2');
  const foam = new THREE.Color(PALETTE.foam);
  const sea = new THREE.Color(PALETTE.sea);
  const color = new THREE.Color();
  const history = [];
  let ribbonTime = 0;
  let sprayBudget = 0;
  let particle = 0;
  let previousTouchdown = null;

  function reset() {
    random = createRandom(seed + 73);
    history.length = 0;
    ribbonTime = 0;
    sprayBudget = 0;
    particle = 0;
    previousTouchdown = null;
    life.fill(0);
    for (let i = 0; i < particleCount; i++) sprayPositions[i * 3 + 1] = parkedY;
    sprayPosition.needsUpdate = true;
    spray.visible = false;
    ribbon.visible = false;
  }

  function writeRibbon() {
    ribbon.visible = history.length > 1;
    ribbonGeometry.setDrawRange(0, Math.max(0, history.length - 1) * 6);
    history.forEach(({ x, z, rightX, rightZ, age }, index) => {
      const progress = Math.min(1, age / ((ribbonPairs - 1) * ribbonInterval));
      const width = THREE.MathUtils.lerp(1.2, 6.5, progress);
      color.copy(sternFoam).lerp(foam, progress).lerp(sea, progress);
      for (let side = 0; side < 2; side++) {
        const offset = width * (side === 0 ? -1 : 1);
        const i = index * 6 + side * 3;
        ribbonPositions[i] = x + rightX * offset;
        ribbonPositions[i + 1] = WORLD.seaLevel + 0.1;
        ribbonPositions[i + 2] = z + rightZ * offset;
        color.toArray(ribbonColors, i);
      }
    });
    ribbonPosition.needsUpdate = true;
    ribbonColor.needsUpdate = true;
  }

  function emit(state, forwardX, forwardZ, rightX, rightZ, burst) {
    const i = particle * 3;
    const side = particle % 2 === 0 ? -1 : 1;
    sprayPositions[i] = state.position.x + rightX * side * 0.91;
    sprayPositions[i + 1] = WORLD.seaLevel + 0.15;
    sprayPositions[i + 2] = state.position.z + rightZ * side * 0.91;
    if (burst) {
      const angle = random() * Math.PI * 2;
      const speed = 1.5 + random() * 3.5;
      velocities[i] = Math.cos(angle) * speed;
      velocities[i + 2] = Math.sin(angle) * speed;
    } else {
      const drift = side * (0.5 + random() * 1.5);
      const trail = state.speed * 0.35;
      velocities[i] = rightX * drift - forwardX * trail;
      velocities[i + 2] = rightZ * drift - forwardZ * trail;
    }
    velocities[i + 1] = 1.5 + random() * 2;
    life[particle] = 0.45 + random() * 0.4;
    particle = (particle + 1) % particleCount;
  }

  function update(state, dt) {
    const forwardX = Math.sin(state.heading);
    const forwardZ = -Math.cos(state.heading);
    const rightX = -forwardZ;
    const rightZ = forwardX;
    const planing = state.grounded && state.onWater && !state.crashed;

    if (history.length || planing && state.speed > 4) {
      for (const sample of history) sample.age += dt;
      while (history.at(-1)?.age >= ribbonLife) history.pop();
      if (planing && state.speed > 4) {
        ribbonTime += dt;
        if (ribbonTime >= ribbonInterval) {
          ribbonTime %= ribbonInterval;
          history.unshift({
            x: state.position.x - forwardX * 2, z: state.position.z - forwardZ * 2, rightX, rightZ, age: 0,
          });
          if (history.length > ribbonPairs) history.pop();
        }
      } else {
        ribbonTime = 0;
      }
      writeRibbon();
    }

    let active = false;
    for (let p = 0; p < particleCount; p++) {
      if (life[p] <= 0) continue;
      const i = p * 3;
      life[p] -= dt;
      if (life[p] <= 0 || sprayPositions[i + 1] < WORLD.seaLevel) {
        life[p] = 0;
        sprayPositions[i + 1] = parkedY;
        continue;
      }
      velocities[i + 1] -= 5.5 * dt;
      for (let axis = 0; axis < 3; axis++) sprayPositions[i + axis] += velocities[i + axis] * dt;
      active = true;
    }

    sprayBudget = planing && state.speed > 8 ? sprayBudget + 90 * dt : 0;
    const count = Math.floor(sprayBudget);
    sprayBudget -= count;
    const touchedWater = state.touchdownSurface === 'lane' || state.touchdownSurface === 'water';
    const burst = touchedWater && previousTouchdown === null;
    previousTouchdown = state.touchdownSurface;
    for (let i = 0; i < count; i++) emit(state, forwardX, forwardZ, rightX, rightZ, false);
    if (burst) {
      for (let i = 0; i < 70; i++) emit(state, forwardX, forwardZ, rightX, rightZ, true);
    }
    if (spray.visible || active || count > 0 || burst) sprayPosition.needsUpdate = true;
    spray.visible = active || count > 0 || burst;
  }

  reset();
  return { update, reset };
}

export function createTrails(scene) {
  if (!TRAILS.enabled) {
    const idle = () => {};
    return { update: idle, seedArc: idle, reset: idle };
  }

  const segments = 26;
  const interval = 0.045;
  const lifetime = 1.1;
  const material = new THREE.MeshBasicMaterial({
    color: '#ffffff', transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide,
  });
  const strips = [-1, 1].map((side) => {
    const geometry = new THREE.BufferGeometry();
    const positions = new THREE.BufferAttribute(new Float32Array((segments + 1) * 6), 3)
      .setUsage(THREE.DynamicDrawUsage);
    const indices = [];
    for (let segment = 0; segment < segments; segment++) {
      const i = segment * 2;
      indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
    geometry.setAttribute('position', positions);
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = side < 0 ? 'Port wingtip trail' : 'Starboard wingtip trail';
    mesh.frustumCulled = false;
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, geometry, positions, side };
  });

  const history = [];
  const angles = new THREE.Euler(0, 0, 0, 'YXZ');
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const tip = new THREE.Vector3();
  let time = 0;

  function draw() {
    for (const { mesh, geometry, positions, side } of strips) {
      mesh.visible = history.length > 1;
      geometry.setDrawRange(0, Math.max(0, history.length - 1) * 6);
      history.forEach(({ position, heading, pitch, roll, age }, i) => {
        angles.set(pitch, -heading, -roll);
        right.set(1, 0, 0).applyEuler(angles);
        up.set(0, 1, 0).applyEuler(angles);
        tip.copy(position).addScaledVector(right, side * 2.85).addScaledVector(up, 0.35);
        const width = 0.36 * Math.max(0, 1 - age / lifetime);
        positions.setXYZ(i * 2, tip.x - right.x * width, tip.y - right.y * width, tip.z - right.z * width);
        positions.setXYZ(i * 2 + 1, tip.x + right.x * width, tip.y + right.y * width, tip.z + right.z * width);
      });
      positions.needsUpdate = true;
    }
  }

  function reset() {
    time = 0;
    history.length = 0;
    draw();
  }

  function update(state, dt) {
    if (dt <= 0) return;
    const active = !state.grounded && !state.crashed && !state.landed
      && state.speed > 30 && Math.abs(state.roll) > 0.30;
    if (!active && history.length === 0) return;
    for (const sample of history) sample.age += dt;
    while (history.at(-1)?.age >= lifetime) history.pop();
    time = active ? time + dt : 0;
    if (time >= interval) {
      time %= interval;
      const { position, heading, pitch, roll } = state;
      history.unshift({ position: position.clone(), heading, pitch, roll, age: 0 });
      if (history.length > segments + 1) history.pop();
    }
    draw();
  }

  function seedArc(state) {
    reset();
    const { position, heading, roll, pitch, speed } = state;
    if (Math.abs(roll) <= 0.30 || speed <= 30) return;
    const radius = speed ** 2 / (Math.tan(roll) * 9.8);
    const rate = speed / radius;
    for (let i = 0; i <= segments; i++) {
      const age = i / segments * lifetime;
      const angle = heading - rate * age;
      const point = position.clone();
      point.x += radius * (Math.cos(heading) - Math.cos(angle));
      point.z += radius * (Math.sin(heading) - Math.sin(angle));
      history.push({ position: point, heading: angle, pitch, roll, age });
    }
    draw();
  }

  return { update, seedArc, reset };
}
