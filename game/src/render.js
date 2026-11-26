// Configures WebGL and positions the chase or screenshot camera.
import * as THREE from 'three';
import { VIEW } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = VIEW.exposure;
  const camera = new THREE.PerspectiveCamera(VIEW.fov, 1, VIEW.near, VIEW.far);
  const direction = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const target = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  let chaseActive = false;

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
    if (chaseActive && !snap) camera.position.lerp(desired, 1 - Math.exp(-VIEW.chaseDamping * dt));
    else camera.position.copy(desired);
    chaseActive = true;
    target.copy(flight.position).addScaledVector(direction, VIEW.chaseLook);
    camera.up.copy(worldUp).applyAxisAngle(direction, flight.roll * VIEW.chaseBank);
    camera.lookAt(target);
  }

  function setShotCamera(position, lookAt) {
    chaseActive = false;
    camera.position.copy(position);
    camera.up.copy(worldUp);
    camera.lookAt(lookAt);
  }

  function render(scene, activeCamera = camera) {
    renderer.render(scene, activeCamera);
  }

  return { renderer, camera, updateCamera, setShotCamera, render };
}
