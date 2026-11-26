// Places the gates, detects crossings, and scores the mail run.
import * as THREE from 'three';
import { AIRCRAFT, COURSE, PALETTE, WORLD, WORLD_SEED } from './config.js';
import { createRandom } from './random.js';
import { runwayCenter, waterlaneCenter, waterlaneHeading } from './world.js';

export function landingLabel(quality) {
  const fraction = quality / COURSE.landingQualityMax;
  if (fraction >= 0.82) return 'Smooth';
  if (fraction >= 0.62) return 'Good';
  if (fraction >= 0.4) return 'Firm';
  return 'Rough';
}

export function landingTimeBonus(elapsed) {
  return Math.max(0, COURSE.parTimeSeconds - elapsed) * COURSE.landingBonusPerSecond;
}

export function createCourse(scene, heightAt, seed = WORLD_SEED) {
  const random = createRandom(seed + COURSE.seedOffset);
  const interval = 2 * Math.PI / COURSE.ringCount;
  const startAngle = Math.atan2(runwayCenter.z, runwayCenter.x);
  const ringPositions = Array.from({ length: COURSE.ringCount }, (_, i) => {
    const angle = startAngle + (i + 0.85) * interval + (random() - 0.5) * COURSE.angleJitter;
    const radius = THREE.MathUtils.lerp(COURSE.radialMin, COURSE.radialMax, random()) * WORLD.size / 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const clearance = THREE.MathUtils.lerp(COURSE.clearanceMin, COURSE.clearanceMax, random());
    return new THREE.Vector3(x, Math.max(heightAt(x, z), WORLD.seaLevel) + clearance, z);
  });
  const geometry = new THREE.TorusGeometry(COURSE.ringRadius, COURSE.ringTube, 12, 48);
  const haloGeometry = new THREE.TorusGeometry(COURSE.ringRadius, COURSE.ringHaloTube, 12, 48);
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: PALETTE.ringNext, transparent: true, opacity: COURSE.ringHaloOpacity,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
  });
  const forward = new THREE.Vector3(0, 0, 1);
  const gates = ringPositions.map((position, i) => {
    const next = ringPositions[i + 1] ?? waterlaneCenter;
    const normal = next.clone().sub(position).normalize();
    const group = new THREE.Group();
    group.name = `Mail gate ${i + 1}`;
    group.position.copy(position);
    group.quaternion.setFromUnitVectors(forward, normal);
    const material = new THREE.MeshBasicMaterial({ toneMapped: false, fog: false });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    group.add(new THREE.Mesh(geometry, material), halo);
    scene.add(group);
    return { group, material, normal, halo };
  });

  const state = {
    nextIndex: 0, ringsPassed: 0, startTime: null, elapsed: 0,
    score: 0, finished: false, landingQuality: 0, timeBonus: 0,
  };
  const previous = new THREE.Vector3();
  const intersection = new THREE.Vector3();
  const offset = new THREE.Vector3();
  let hasPrevious = false;
  let clock = 0;

  function updateVisuals() {
    gates.forEach(({ group, material, halo }, index) => {
      const passed = index < state.nextIndex;
      const active = index === state.nextIndex && !state.finished;
      const color = passed ? PALETTE.ringPassed : active ? PALETTE.ringNext : PALETTE.ring;
      const pulse = active ? Math.sin(state.elapsed * 4.2) : 0;
      group.scale.setScalar(1 + pulse * 0.045);
      material.color.set(color);
      halo.visible = active;
    });
  }

  function reset(position) {
    Object.assign(state, {
      nextIndex: 0, ringsPassed: 0, startTime: null, elapsed: 0,
      score: 0, finished: false, landingQuality: 0, timeBonus: 0,
    });
    clock = 0;
    hasPrevious = Boolean(position);
    if (position) previous.copy(position);
    updateVisuals();
  }

  function update(run, flight, dt) {
    if (run.finished) return;
    clock += dt;
    if (run.startTime === null && !flight.grounded && !flight.crashed) run.startTime = clock;
    if (run.startTime !== null) run.elapsed = clock - run.startTime;

    while (hasPrevious && !flight.grounded && run.nextIndex < gates.length) {
      const { group, normal } = gates[run.nextIndex];
      const oldSide = offset.copy(previous).sub(group.position).dot(normal);
      const newSide = offset.copy(flight.position).sub(group.position).dot(normal);
      if (oldSide === 0 || oldSide * newSide > 0 || oldSide === newSide) break;
      intersection.copy(previous).lerp(flight.position, oldSide / (oldSide - newSide));
      if (intersection.distanceToSquared(group.position) > COURSE.ringRadius ** 2) break;
      previous.copy(intersection);
      run.nextIndex++;
      run.ringsPassed++;
      run.score += COURSE.ringScore;
    }
    previous.copy(flight.position);
    hasPrevious = true;

    if (flight.landed || flight.crashed) {
      run.finished = true;
      if (flight.landed && flight.touchdownSurface === 'lane' && run.ringsPassed === gates.length) {
        const crosswindAngle = Math.asin(Math.abs(Math.sin(flight.heading - waterlaneHeading)));
        const descent = 1 - Math.abs(flight.verticalSpeed) / AIRCRAFT.landingSink;
        const speed = 1 - Math.abs(flight.speed - COURSE.landingIdealSpeed) / COURSE.landingSpeedRange;
        const alignment = 1 - crosswindAngle / COURSE.landingAlignment;
        const quality = 0.5 * Math.max(0, descent) + 0.25 * Math.max(0, speed) + 0.25 * Math.max(0, alignment);
        run.landingQuality = Math.round(quality * COURSE.landingQualityMax);
        run.timeBonus = Math.round(landingTimeBonus(run.elapsed));
        run.score += run.landingQuality + run.timeBonus;
      }
    }
    updateVisuals();
  }

  reset();
  return {
    state, ringPositions, ringNormals: gates.map(({ normal }) => normal),
    reset, update, updateVisuals,
    get target() { return ringPositions[state.nextIndex] ?? waterlaneCenter; },
  };
}
