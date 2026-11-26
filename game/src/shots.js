// Stages deterministic flight poses and camera views for the four screenshots.
import * as THREE from 'three';
import { COURSE, RUNWAY, STEP, VIEW } from './config.js';
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
    const direction = course.ringNormals[2].clone();
    direction.y = 0;
    direction.normalize();
    flight.reset(target.clone().addScaledVector(direction, -55), headingFor(direction));
    Object.assign(flight.state, { speed: 48, roll: radians(6) });
    Object.assign(course.state, { nextIndex: 2, ringsPassed: 2, elapsed: 68, score: 200 });
  } else if (name === 'bank') {
    const target = course.ringPositions[4];
    const incoming = target.clone().sub(course.ringPositions[3]);
    incoming.y = 0;
    incoming.normalize();
    const position = target.clone().addScaledVector(incoming, -130);
    position.y += 10;
    const direction = target.clone().sub(position).normalize();
    flight.reset(position, headingFor(direction));
    Object.assign(flight.state, { speed: 52, roll: radians(42), pitch: Math.asin(direction.y) });
    Object.assign(course.state, { nextIndex: 4, ringsPassed: 4, elapsed: 121, score: 400 });
    const cameraPosition = position.clone().addScaledVector(incoming, -12);
    cameraPosition.y += 4.5;
    renderer.setShotCamera(cameraPosition, target);
  } else if (name === 'finish') {
    const position = runwayCenter.clone().addScaledVector(runwayTangent, -260);
    position.y = 26;
    flight.reset(position, runwayHeading);
    Object.assign(flight.state, { speed: 30, pitch: radians(-2) });
    const elapsed = 192;
    const landingQuality = 465;
    const timeBonus = landingTimeBonus(elapsed);
    Object.assign(course.state, {
      nextIndex: COURSE.ringCount, ringsPassed: COURSE.ringCount, elapsed, finished: true,
      landingQuality, timeBonus, score: COURSE.ringCount * COURSE.ringScore + landingQuality + timeBonus,
    });
    const cameraPosition = position.clone().addScaledVector(runwayTangent, -16);
    cameraPosition.y += 6;
    const lookAt = position.clone().addScaledVector(runwayTangent, VIEW.chaseLook);
    lookAt.y += Math.tan(flight.state.pitch * VIEW.chasePitch) * VIEW.chaseLook;
    renderer.setShotCamera(cameraPosition, lookAt);
    screen = 'over';
  } else {
    throw new Error(`Unknown screenshot scene "${name}"`);
  }
  if (name === 'ring') renderer.updateCamera(flight.state, STEP);
  course.updateVisuals();
  return { screen };
}
