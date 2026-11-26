// Builds the mail seaplane and updates its flight and touchdown state.
import * as THREE from 'three';
import { AIRCRAFT, PALETTE, STALL } from './config.js';
import { isOnRunway, isOnWaterLane, WORLD } from './world.js';

export function buildSeaplane() {
  const group = new THREE.Group();
  group.name = 'Duskmail seaplane';
  const cream = new THREE.MeshStandardMaterial({ color: PALETTE.mailCream, roughness: 0.42 });
  const red = new THREE.MeshStandardMaterial({ color: PALETTE.mailRed, roughness: 0.4 });
  const metal = new THREE.MeshStandardMaterial({ color: PALETTE.metal, metalness: 0.45, roughness: 0.38 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#172834', metalness: 0.12, roughness: 0.23, clearcoat: 0.85, clearcoatRoughness: 0.16,
  });
  const livery = new THREE.MeshStandardMaterial({ color: '#c58443', roughness: 0.46 });

  function add(parent, geometry, material, x, y, z) {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(x, y, z);
    parent.add(part);
    return part;
  }

  const fuselage = add(group, new THREE.CapsuleGeometry(0.5, 2.55, 6, 12), cream, 0, 0, 0);
  fuselage.rotation.x = Math.PI / 2;
  for (const angle of [Math.PI / 2, Math.PI * 1.5]) {
    const stripe = new THREE.CylinderGeometry(0.503, 0.503, 2.54, 6, 1, true, angle - 0.19, 0.38);
    stripe.rotateX(Math.PI / 2);
    add(group, stripe, livery, 0, 0, 0);
  }
  const cowl = add(group, new THREE.CylinderGeometry(0.43, 0.49, 0.56, 16), red, 0, 0, -1.48);
  cowl.rotation.x = -Math.PI / 2;
  const canopy = add(group, new THREE.SphereGeometry(1, 16, 10), glass, 0, 0.36, -0.43);
  canopy.scale.set(0.4, 0.49, 0.75);

  const wing = new THREE.BoxGeometry(2.22, 0.13, 0.94);
  const wingTip = new THREE.BoxGeometry(0.42, 0.135, 0.94);
  const floatBody = new THREE.CapsuleGeometry(0.26, 2.26, 5, 10);
  const strut = new THREE.BoxGeometry(0.1, 0.63, 0.13);
  const navBulb = new THREE.SphereGeometry(0.085, 10, 8);

  function navLight(color, x, y, z) {
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.4 });
    add(group, navBulb, material, x, y, z);
  }

  function wingBrace(side, z) {
    const start = new THREE.Vector3(side * 0.92, -0.65, z);
    const end = new THREE.Vector3(side * 1.95, 0.24, z - 0.06);
    const length = start.distanceTo(end);
    const middle = start.clone().lerp(end, 0.5);
    const brace = add(group, new THREE.CylinderGeometry(0.035, 0.042, length, 6),
      metal, middle.x, middle.y, middle.z);
    brace.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
  }

  for (const side of [-1, 1]) {
    const panel = new THREE.Group();
    panel.position.set(side * 0.27, 0.18, -0.16);
    panel.rotation.z = side * 0.075;
    add(panel, wing, cream, side * 1.11, 0, 0);
    add(panel, wingTip, red, side * 2.43, 0, 0);
    group.add(panel);

    const float = add(group, floatBody, cream, side * 0.91, -0.82, -0.09);
    float.rotation.x = Math.PI / 2;
    float.scale.set(1, 1.06, 0.94);
    for (const z of [-0.68, 0.58]) {
      const support = add(group, strut, metal, side * 0.78, -0.39, z);
      support.rotation.z = side * 0.36;
    }
    wingBrace(side, -0.44);
    wingBrace(side, 0.14);
    navLight(side < 0 ? PALETTE.navPort : PALETTE.navStarboard, side * 2.91, 0.38, -0.16);
  }

  add(group, new THREE.BoxGeometry(1.85, 0.11, 0.57), cream, 0, 0.14, 1.37);
  const fin = add(group, new THREE.BoxGeometry(0.105, 0.73, 0.48), red, 0, 0.37, 1.4);
  fin.rotation.x = 0.27;
  add(fin, new THREE.BoxGeometry(0.108, 0.12, 0.483), cream, 0, 0.165, 0);
  add(fin, new THREE.BoxGeometry(0.109, 0.048, 0.483), livery, 0, 0.08, 0);
  const antenna = add(group, new THREE.CylinderGeometry(0.012, 0.022, 0.35, 6), metal, 0, 0.63, 0.38);
  antenna.rotation.x = 0.22;
  const exhaust = add(group, new THREE.CylinderGeometry(0.048, 0.063, 0.27, 8), metal, 0.43, -0.22, -1.03);
  exhaust.rotation.x = Math.PI / 2;
  navLight(PALETTE.navTail, 0, 0.13, 1.73);

  const propeller = new THREE.Group();
  propeller.position.z = -1.86;
  const blade = new THREE.BoxGeometry(0.115, 0.78, 0.045);
  add(propeller, blade, metal, 0, 0.41, 0);
  add(propeller, blade, metal, 0, -0.41, 0);
  const spinner = add(propeller, new THREE.ConeGeometry(0.17, 0.3, 12), red, 0, 0, -0.1);
  spinner.rotation.x = -Math.PI / 2;
  group.add(propeller);
  const blurMaterial = new THREE.MeshBasicMaterial({
    color: 0xf3e9d2, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false,
  });
  const blurDisc = add(group, new THREE.CircleGeometry(0.88, 32), blurMaterial, 0, 0, -1.88);
  blurDisc.name = 'Propeller blur disc';

  return {
    group,
    propeller,
    spinPropeller(dt, throttle) {
      propeller.rotation.z = (propeller.rotation.z
        + dt * (AIRCRAFT.propellerIdle + throttle * AIRCRAFT.propellerPower)) % (2 * Math.PI);
    },
  };
}

export function createFlight() {
  const state = {
    position: new THREE.Vector3(),
    heading: 0, pitch: 0, roll: 0,
    speed: AIRCRAFT.minSpeed, throttle: AIRCRAFT.initialThrottle,
    verticalSpeed: 0, grounded: false, crashed: false, landed: false,
    aoa: 0, stall: 0, stallWarn: false, onWater: false, touchdownSurface: null,
  };
  const velocity = new THREE.Vector3();
  const desiredVelocity = new THREE.Vector3();

  // Heading increases toward +X from -Z. Positive pitch climbs and positive roll banks right.
  function forwardVector(target = new THREE.Vector3()) {
    const horizontal = Math.cos(state.pitch);
    return target.set(
      Math.sin(state.heading) * horizontal,
      Math.sin(state.pitch),
      -Math.cos(state.heading) * horizontal,
    );
  }

  function reset(position, heading = 0, parked = false) {
    state.position.copy(position);
    state.heading = heading;
    state.pitch = 0;
    state.roll = 0;
    state.grounded = parked;
    state.throttle = parked ? 0 : AIRCRAFT.initialThrottle;
    state.speed = parked ? 0 : THREE.MathUtils.lerp(AIRCRAFT.minSpeed, AIRCRAFT.maxSpeed, state.throttle);
    forwardVector(velocity).multiplyScalar(state.speed);
    state.verticalSpeed = 0;
    state.aoa = 0;
    state.stall = 0;
    state.stallWarn = false;
    state.crashed = false;
    state.landed = false;
    state.onWater = parked && isOnWaterLane(position.x, position.z);
    state.touchdownSurface = null;
  }

  function step(dt, input, heightAt) {
    if (state.crashed || state.landed) return;
    const pitch = input.pitchInput();
    const roll = state.grounded ? 0 : input.rollInput();
    state.throttle = THREE.MathUtils.clamp(state.throttle + input.throttleInput() * AIRCRAFT.throttleRate * dt, 0, 1);
    state.roll = THREE.MathUtils.damp(state.roll, roll * AIRCRAFT.maxRoll,
      roll ? AIRCRAFT.rollRate : AIRCRAFT.autoLevelRoll, dt);
    const gamma = Math.asin(THREE.MathUtils.clamp(velocity.y / Math.max(velocity.length(), 1), -1, 1));
    const bankLift = Math.cos(Math.abs(state.roll));
    const load = Math.min(STALL.loadLimit, 1 / bankLift);
    const criticalAngle = STALL.aoaCrit - STALL.loadPenalty * (load - 1);
    const warningAngle = criticalAngle - (STALL.aoaCrit - STALL.aoaWarn);
    state.aoa = state.grounded ? 0 : state.pitch - gamma;
    state.stall = state.grounded ? 0 : THREE.MathUtils.clamp((state.aoa - warningAngle) / STALL.fadeBand, 0, 1);
    state.stallWarn = state.stall > 0;

    const canPitch = !state.grounded || state.speed >= AIRCRAFT.takeoffSpeed;
    const pitchRate = (pitch ? AIRCRAFT.pitchRate : AIRCRAFT.autoLevelPitch)
      * (1 - STALL.pitchAuthorityLoss * state.stall);
    state.pitch = THREE.MathUtils.damp(state.pitch, canPitch ? pitch * AIRCRAFT.maxPitch : 0,
      pitchRate, dt);
    state.pitch -= state.stall * STALL.noseDropRate * dt;

    const throttleSpeed = THREE.MathUtils.lerp(AIRCRAFT.minSpeed, AIRCRAFT.maxSpeed, state.throttle);
    const targetSpeed = state.grounded
      ? Math.max(0, (state.throttle - AIRCRAFT.takeoffThrottle) / (1 - AIRCRAFT.takeoffThrottle)) * AIRCRAFT.maxSpeed
      : THREE.MathUtils.clamp(throttleSpeed - state.pitch * AIRCRAFT.pitchSpeedFactor,
        AIRCRAFT.minSpeed, AIRCRAFT.maxSpeed);
    const waterDrag = state.grounded && state.speed < AIRCRAFT.takeoffSpeed
      && heightAt(state.position.x, state.position.z) <= WORLD.seaLevel + 0.05;
    const speedResponse = AIRCRAFT.speedResponse * (waterDrag ? AIRCRAFT.waterSpeedResponse : 1);
    state.speed = THREE.MathUtils.damp(state.speed, targetSpeed, speedResponse, dt);
    state.heading += Math.sin(state.roll) * AIRCRAFT.turnFactor
      * state.speed / AIRCRAFT.turnReferenceSpeed * dt;

    forwardVector(desiredVelocity).multiplyScalar(state.speed);
    if (state.grounded) {
      velocity.copy(desiredVelocity);
    } else {
      // At low airspeed the flight path takes longer to follow a pitch change.
      const airflow = THREE.MathUtils.smoothstep(state.speed, STALL.liftSpeedLow, STALL.liftSpeedFull);
      const authority = THREE.MathUtils.lerp(STALL.liftAuthorityLow, 1, airflow);
      const response = THREE.MathUtils.lerp(STALL.liftResponse, STALL.liftResponseStalled, state.stall);
      const vertical = THREE.MathUtils.damp(velocity.y, desiredVelocity.y, response * authority, dt);
      velocity.lerp(desiredVelocity, 1 - Math.exp(-response * dt));
      velocity.y = vertical - state.stall * STALL.sinkRate * dt;
      velocity.y -= (1 - bankLift) * 9.8 * STALL.bankSinkScale * dt;
    }
    if (state.grounded && velocity.y > 0) state.grounded = false;
    if (state.grounded) velocity.y = 0;
    state.verticalSpeed = velocity.y;
    state.position.addScaledVector(velocity, dt);

    const { x, z } = state.position;
    const terrainH = heightAt(x, z);
    state.onWater = terrainH <= WORLD.seaLevel + 0.05;
    const contact = Math.max(terrainH, WORLD.seaLevel) + AIRCRAFT.groundClearance;
    if (state.grounded) {
      state.position.y = contact;
      if (!state.onWater && !isOnRunway(x, z)) state.crashed = true;
    } else if (state.position.y <= contact) {
      state.position.y = contact;
      state.touchdownSurface = state.onWater ? (isOnWaterLane(x, z) ? 'lane' : 'water') : 'land';
      state.landed = state.onWater && Math.abs(velocity.y) <= AIRCRAFT.landingSink
        && state.speed <= AIRCRAFT.landingSpeed && Math.abs(state.roll) <= AIRCRAFT.landingRoll;
      state.crashed = !state.landed;
      state.grounded = false;
    }
  }

  return { state, reset, step, forwardVector };
}
