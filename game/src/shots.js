// Stages deterministic flight poses and camera views for the four screenshots.
import * as THREE from 'three';
import { AIRCRAFT, COURSE, STEP, VIEW, WATERLANE, WORLD } from './config.js';
import { landingTimeBonus } from './course.js';
import { waterlaneCenter, waterlaneHeading, waterlaneTangent } from './world.js';

const radians = THREE.MathUtils.degToRad;
const headingFor = (direction) => Math.atan2(direction.x, -direction.z);

export function stageShot(name, { flight, course, renderer, heightAt, wake }) {
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
  } else if (name === 'ring') {
    const target = course.ringPositions[2];
    const normal = course.ringNormals[2];
    const direction = normal.clone().setY(0).normalize();
    const position = target.clone().addScaledVector(direction, -30);
    flight.reset(position, headingFor(direction));
    Object.assign(flight.state, { speed: 48, roll: radians(6), throttle: 0.8 });
    Object.assign(course.state, { nextIndex: 2, ringsPassed: 2, elapsed: 68, score: 200 });
    renderer.updateCamera(flight.state, STEP);
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
    Object.assign(flight.state, { speed: 52, roll: radians(42), pitch: Math.asin(direction.y), throttle: 0.85 });
    Object.assign(course.state, { nextIndex: 4, ringsPassed: 4, elapsed: 121, score: 400 });
    const cameraPosition = position.clone().addScaledVector(direction, -13);
    cameraPosition.y += 4.5;
    const lookAt = position.clone().addScaledVector(direction, VIEW.chaseLook).lerp(target, 0.5);
    renderer.setShotCamera(cameraPosition, lookAt);
  } else if (name === 'finish') {
    const position = waterlaneCenter.clone().addScaledVector(waterlaneTangent, 40);
    position.y = WORLD.seaLevel + AIRCRAFT.groundClearance;
    flight.reset(position, waterlaneHeading + Math.PI, true);
    const elapsed = 192;
    const landingQuality = 465;
    const timeBonus = landingTimeBonus(elapsed);
    Object.assign(course.state, {
      nextIndex: COURSE.ringCount, ringsPassed: COURSE.ringCount, elapsed, finished: true,
      landingQuality, timeBonus, score: COURSE.ringCount * COURSE.ringScore + landingQuality + timeBonus,
    });
    const outward = position.clone().setY(0).normalize();
    const cameraPosition = position.clone().addScaledVector(outward, 11).addScaledVector(waterlaneTangent, 6.5);
    cameraPosition.y += 4.0;
    const lookAt = position.clone();
    lookAt.y += 0.8;
    renderer.setShotCamera(cameraPosition, lookAt);
    screen = 'over';
  } else {
    throw new Error(`Unknown screenshot scene "${name}"`);
  }
  course.updateVisuals();
  return { screen };
}
