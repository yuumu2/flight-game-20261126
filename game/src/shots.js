// Stages deterministic flight poses and camera views for the four screenshots.
import * as THREE from 'three';
import { AIRCRAFT, COURSE, SCENERY, STEP, VIEW, WATERLANE, WORLD } from './config.js';
import { landingTimeBonus } from './course.js';
import { waterlaneCenter, waterlaneHeading, waterlaneTangent } from './world.js';

const radians = THREE.MathUtils.degToRad;
const headingFor = (direction) => Math.atan2(direction.x, -direction.z);

export function stageShot(name, { scene, flight, course, renderer, heightAt, wake }) {
  course.reset();
  let screen = 'play';
  if (name === 'takeoff') {
    const spawn = waterlaneCenter.clone().addScaledVector(waterlaneTangent, WATERLANE.length / 2 - 26);
    spawn.y = WORLD.seaLevel + AIRCRAFT.groundClearance;
    flight.reset(spawn, waterlaneHeading + Math.PI, true);
    course.state.elapsed = 5;
    const throttleUp = {
      stepIndex: 0,
      pitchInput: () => 0,
      rollInput: () => 0,
      throttleInput() { return Math.min(1, this.stepIndex / 90); },
    };
    for (; throttleUp.stepIndex < 200; throttleUp.stepIndex++) {
      flight.step(STEP, throttleUp, heightAt);
      wake.update(flight.state, STEP);
    }
    const { position, heading } = flight.state;
    flight.state.pitch = radians(7);
    const forward = new THREE.Vector3(Math.sin(heading), 0, -Math.cos(heading));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const cameraPosition = position.clone().addScaledVector(forward, -13.5).addScaledVector(right, 4.5);
    cameraPosition.y += 3.4;
    const lookAt = position.clone().addScaledVector(forward, 38);
    lookAt.y += 0.5;
    renderer.setShotCamera(cameraPosition, lookAt);
  } else if (name === 'cockpit') {
    const target = course.ringPositions[2];
    const normal = course.ringNormals[2];
    const direction = normal.clone().setY(0).normalize();
    const position = target.clone().addScaledVector(direction, -46);
    position.y -= 3;
    flight.reset(position, headingFor(direction));
    Object.assign(flight.state, { speed: 48, roll: radians(6), throttle: 0.8, engineThrottle: 0.8, fuel: 0.62 });
    Object.assign(course.state, { nextIndex: 2, ringsPassed: 2, elapsed: 68, score: 200 });
    renderer.updateCockpitCamera(flight.state);
    course.updateVisuals();
    return { screen: 'play', cameraMode: 'cockpit' };
  } else if (name === 'ring') {
    const index = 7;
    const target = course.ringPositions[index];
    const axis = course.ringNormals[index].clone().setY(0).normalize();
    const lateral = new THREE.Vector3(-axis.z, 0, axis.x);
    const position = target.clone().addScaledVector(axis, -60).addScaledVector(lateral, -30);
    position.y += 17;
    const sunAzimuth = radians(SCENERY.sunAzimuth);
    const sunward = new THREE.Vector3(Math.cos(sunAzimuth), 0, Math.sin(sunAzimuth));
    const direction = target.clone().addScaledVector(lateral, -19.5).sub(position).setY(0)
      .normalize().lerp(sunward, 0.22).normalize();
    flight.reset(position, headingFor(direction));
    Object.assign(flight.state, {
      speed: 54, roll: radians(40), pitch: -0.08, throttle: 0.82, engineThrottle: 0.82, fuel: 0.49,
    });
    Object.assign(course.state, {
      nextIndex: index, ringsPassed: index, elapsed: 151, score: index * COURSE.ringScore,
    });
    const right = new THREE.Vector3(-direction.z, 0, direction.x);
    const cameraPosition = position.clone().addScaledVector(direction, -9).addScaledVector(right, -8);
    cameraPosition.y += 3.8;
    const lookAt = position.clone().lerp(target, 0.12);
    lookAt.y += 0.1;
    renderer.setShotCamera(cameraPosition, lookAt);
  } else if (name === 'bank') {
    const target = course.ringPositions[4];
    const incoming = target.clone().sub(course.ringPositions[3]);
    incoming.y = 0;
    const gateAxis = course.ringNormals[4].clone().setY(0).normalize();
    // Bias the approach toward the gate axis to show its aperture.
    incoming.normalize().lerp(gateAxis, 0.12).normalize();
    const perpendicular = new THREE.Vector3(-incoming.z, 0, incoming.x);
    const position = target.clone().addScaledVector(incoming, -130).addScaledVector(perpendicular, 22);
    position.y -= 14;
    const direction = target.clone().addScaledVector(perpendicular, 6).sub(position).normalize();
    flight.reset(position, headingFor(direction));
    Object.assign(flight.state, {
      speed: 52, roll: radians(42), pitch: Math.asin(direction.y), throttle: 0.85, engineThrottle: 0.85, fuel: 0.7,
    });
    Object.assign(course.state, { nextIndex: 4, ringsPassed: 4, elapsed: 121, score: 400 });
    const cameraPosition = position.clone().addScaledVector(direction, -13);
    cameraPosition.y += 4.5;
    const lookAt = position.clone().addScaledVector(direction, VIEW.chaseLook).lerp(target, 0.5);
    renderer.setShotCamera(cameraPosition, lookAt);
  } else if (name === 'finish') {
    const dock = scene?.getObjectByName('Village dock and boats')?.position;
    const rollDistance = 43.24;
    const laneEnd = WATERLANE.length / 2 - 8;
    const berth = dock ? dock.clone().sub(waterlaneCenter).dot(waterlaneTangent) : 55 + rollDistance;
    const along = THREE.MathUtils.clamp(berth, -laneEnd + rollDistance, laneEnd);
    const approach = waterlaneCenter.clone().addScaledVector(waterlaneTangent, along - rollDistance);
    approach.y += AIRCRAFT.groundClearance + 0.34;
    flight.reset(approach, waterlaneHeading);
    const state = flight.state;
    Object.assign(state, { speed: 26, throttle: 0.17, engineThrottle: 0.17 });
    const landingInput = { pitchInput: () => -0.22, rollInput: () => 0, throttleInput: () => 0 };
    for (let step = 0; step < 120 && !state.landed && !state.crashed; step++) {
      flight.step(STEP, landingInput, heightAt);
      wake.update(state, STEP);
    }
    if (!state.landed || state.touchdownSurface !== 'lane') throw new Error('Staged landing missed the water lane');
    // Live play ends at contact. Continue the grounded roll only for this staged wake.
    Object.assign(state, { grounded: true, landed: false, pitch: 0 });
    const coastInput = { pitchInput: () => 0, rollInput: () => 0, throttleInput: () => -1 };
    for (let step = 0; step < 44; step++) {
      flight.step(STEP, coastInput, heightAt);
      wake.update(state, STEP);
    }
    Object.assign(state, { grounded: false, landed: true, fuel: 0.34 });
    const elapsed = 192;
    const landingQuality = 465;
    const timeBonus = landingTimeBonus(elapsed);
    Object.assign(course.state, {
      nextIndex: COURSE.ringCount, ringsPassed: COURSE.ringCount, elapsed, finished: true,
      landingQuality, timeBonus, score: COURSE.ringCount * COURSE.ringScore + landingQuality + timeBonus,
    });
    const position = state.position;
    const shore = dock?.clone() ?? position.clone().setY(0).multiplyScalar(2.8);
    const viewDirection = shore.sub(position).setY(0).normalize();
    viewDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), radians(26));
    const right = new THREE.Vector3(-viewDirection.z, 0, viewDirection.x);
    const cameraPosition = position.clone().addScaledVector(viewDirection, -22).addScaledVector(right, 8);
    cameraPosition.y = WORLD.seaLevel + 9;
    const lookAt = position.clone().addScaledVector(right, 16);
    lookAt.y = cameraPosition.y - Math.hypot(22, 8) * Math.tan(radians(13));
    renderer.setShotCamera(cameraPosition, lookAt);
    screen = 'over';
  } else {
    throw new Error(`Unknown screenshot scene "${name}"`);
  }
  course.updateVisuals();
  return { screen };
}
