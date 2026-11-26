// Stages deterministic flight poses and camera views for the four screenshots.
import * as THREE from 'three';
import { AIRCRAFT, COURSE, RUNWAY, STEP, VIEW } from './config.js';
import { landingTimeBonus } from './course.js';
import { runwayCenter, runwayHeading, runwayTangent } from './world.js';

const radians = THREE.MathUtils.degToRad;
const headingFor = (direction) => Math.atan2(direction.x, -direction.z);

export function stageShot(name, { flight, course, renderer }) {
  course.reset();
  let screen = 'play';
  if (name === 'takeoff') {
    const position = runwayCenter.clone().addScaledVector(runwayTangent, -0.25 * RUNWAY.length);
    position.y = RUNWAY.elevation + 3;
    flight.reset(position, runwayHeading);
    Object.assign(flight.state, { pitch: radians(10), speed: 38, throttle: 1 });
    course.state.elapsed = 4;
    const cameraPosition = position.clone().addScaledVector(runwayTangent, -13);
    cameraPosition.y += 4.5;
    const lookAt = position.clone().addScaledVector(runwayTangent, VIEW.chaseLook);
    lookAt.y += Math.tan(flight.state.pitch * VIEW.chasePitch) * VIEW.chaseLook;
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
    const position = runwayCenter.clone().addScaledVector(runwayTangent, 0.18 * RUNWAY.length);
    position.y = RUNWAY.elevation + AIRCRAFT.groundClearance;
    flight.reset(position, runwayHeading, true);
    const elapsed = 192;
    const landingQuality = 465;
    const timeBonus = landingTimeBonus(elapsed);
    Object.assign(course.state, {
      nextIndex: COURSE.ringCount, ringsPassed: COURSE.ringCount, elapsed, finished: true,
      landingQuality, timeBonus, score: COURSE.ringCount * COURSE.ringScore + landingQuality + timeBonus,
    });
    const cameraPosition = position.clone().addScaledVector(runwayTangent, -16);
    const perpendicular = new THREE.Vector3(-runwayTangent.z, 0, runwayTangent.x);
    cameraPosition.addScaledVector(perpendicular, 7);
    cameraPosition.y += 6;
    const lookAt = position.clone().addScaledVector(runwayTangent, VIEW.chaseLook);
    lookAt.y += Math.tan(flight.state.pitch * VIEW.chasePitch) * VIEW.chaseLook;
    renderer.setShotCamera(cameraPosition, lookAt);
    screen = 'over';
  } else {
    throw new Error(`Unknown screenshot scene "${name}"`);
  }
  course.updateVisuals();
  return { screen };
}
