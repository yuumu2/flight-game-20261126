// Configures WebGL and positions the chase or screenshot camera.
import * as THREE from 'three';
import { STALL, VIEW } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = VIEW.exposure;
  const camera = new THREE.PerspectiveCamera(VIEW.fov, 1, VIEW.near, VIEW.far);
  const direction = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const chasePosition = new THREE.Vector3();
  const target = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const cockpitRotation = new THREE.Euler(0, 0, 0, 'YXZ');
  const cockpitEye = new THREE.Vector3();
  const cockpitForward = new THREE.Vector3();
  let chaseActive = false;
  let buffetClock = 0;
  let cameraMode = 'chase';

  function resize() {
    const width = window.innerWidth;
    const height = Math.max(1, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, VIEW.pixelRatio));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function updateCamera(flight, dt, snap = false) {
    const pitch = flight.pitch * VIEW.chasePitch;
    direction.set(Math.sin(flight.heading) * Math.cos(pitch), Math.sin(pitch),
      -Math.cos(flight.heading) * Math.cos(pitch));
    desired.copy(flight.position).addScaledVector(direction, -VIEW.chaseBack);
    desired.y += VIEW.chaseUp;
    if (chaseActive && !snap) chasePosition.lerp(desired, 1 - Math.exp(-VIEW.chaseDamping * dt));
    else chasePosition.copy(desired);
    chaseActive = true;
    buffetClock += dt;
    camera.position.copy(chasePosition);
    if (flight.stall > 0) {
      const lateral = Math.sin(buffetClock * STALL.buffetLateralRate) * STALL.buffetLateral * flight.stall;
      camera.position.x += Math.cos(flight.heading) * lateral;
      camera.position.z += Math.sin(flight.heading) * lateral;
      camera.position.y += Math.sin(buffetClock * STALL.buffetVerticalRate) * STALL.buffetVertical * flight.stall;
    }
    target.copy(flight.position).addScaledVector(direction, VIEW.chaseLook);
    const buffetRoll = Math.sin(buffetClock * STALL.buffetRollRate) * STALL.buffetRoll * flight.stall;
    camera.up.copy(worldUp).applyAxisAngle(direction, flight.roll * VIEW.chaseBank + buffetRoll);
    camera.lookAt(target);
  }

  function setShotCamera(position, lookAt) {
    chaseActive = false;
    camera.position.copy(position);
    camera.up.copy(worldUp);
    camera.lookAt(lookAt);
  }

  function setCameraMode(mode) {
    cameraMode = mode;
    camera.near = mode === 'cockpit' ? 0.1 : VIEW.near;
    camera.updateProjectionMatrix();
  }

  function getCameraMode() {
    return cameraMode;
  }

  function updateCockpitCamera(flight) {
    cockpitRotation.set(flight.pitch, -flight.heading, -flight.roll);
    cockpitEye.set(0, 0.55, -0.05).applyEuler(cockpitRotation).add(flight.position);
    cockpitForward.set(0, 0, -1).applyEuler(cockpitRotation);
    camera.position.copy(cockpitEye);
    camera.up.copy(worldUp).applyEuler(cockpitRotation);
    camera.lookAt(cockpitForward.add(cockpitEye));
    chaseActive = false;
  }

  function render(scene, activeCamera = camera) {
    renderer.render(scene, activeCamera);
  }

  return { renderer, camera, updateCamera, setShotCamera, setCameraMode, getCameraMode, updateCockpitCamera, render };
}
