// Builds the mail seaplane and updates its flight and touchdown state.
import * as THREE from 'three';
import { AIRCRAFT, FUEL, PALETTE, STALL } from './config.js';
import { createCockpitTexture } from './cockpit.js';
import { isOnRunway, isOnWaterLane, WORLD } from './world.js';

function aircraftMaterials() {
  const cream = new THREE.MeshStandardMaterial({ color: PALETTE.mailCream, roughness: 0.34, metalness: 0.05 });
  const red = new THREE.MeshStandardMaterial({ color: PALETTE.mailRed, roughness: 0.34 });
  const metal = new THREE.MeshStandardMaterial({ color: PALETTE.metal, metalness: 0.45, roughness: 0.38 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#172834', metalness: 0.12, roughness: 0.23, clearcoat: 0.85, clearcoatRoughness: 0.16,
  });
  const livery = new THREE.MeshStandardMaterial({ color: '#c58443', roughness: 0.40 });
  function navLight(color) {
    return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.4 });
  }
  return {
    cream, red, metal, glass, livery,
    navPort: navLight(PALETTE.navPort),
    navStarboard: navLight(PALETTE.navStarboard),
    navTail: navLight(PALETTE.navTail),
  };
}

function buildPrimitiveSeaplane(materials) {
  const group = new THREE.Group();
  const { cream, red, metal, glass, livery } = materials;

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
  canopy.name = 'Canopy';
  canopy.scale.set(0.4, 0.49, 0.75);

  const wing = new THREE.BoxGeometry(2.22, 0.13, 0.94);
  const wingTip = new THREE.BoxGeometry(0.42, 0.135, 0.94);
  const floatBody = new THREE.CapsuleGeometry(0.26, 2.26, 5, 10);
  const strut = new THREE.BoxGeometry(0.1, 0.63, 0.13);
  const navBulb = new THREE.SphereGeometry(0.085, 10, 8);
  const wings = [];

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
    panel.name = side < 0 ? 'Wing panel Port' : 'Wing panel Starboard';
    panel.position.set(side * 0.27, 0.18, -0.16);
    panel.rotation.z = side * 0.075;
    add(panel, wing, cream, side * 1.11, 0, 0);
    add(panel, wingTip, red, side * 2.43, 0, 0);
    group.add(panel);
    wings.push(panel);

    const float = add(group, floatBody, cream, side * 0.91, -0.82, -0.09);
    float.rotation.x = Math.PI / 2;
    float.scale.set(1, 1.06, 0.94);
    for (const z of [-0.68, 0.58]) {
      const support = add(group, strut, metal, side * 0.78, -0.39, z);
      support.rotation.z = side * 0.36;
    }
    wingBrace(side, -0.44);
    wingBrace(side, 0.14);
    add(group, navBulb, side < 0 ? materials.navPort : materials.navStarboard, side * 2.91, 0.38, -0.16);
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
  add(group, navBulb, materials.navTail, 0, 0.13, 1.73);

  const propeller = new THREE.Group();
  propeller.position.z = -1.86;
  const blade = new THREE.BoxGeometry(0.115, 0.78, 0.045);
  add(propeller, blade, metal, 0, 0.41, 0);
  add(propeller, blade, metal, 0, -0.41, 0);
  const spinner = add(propeller, new THREE.ConeGeometry(0.17, 0.3, 12), red, 0, 0, -0.1);
  spinner.rotation.x = -Math.PI / 2;
  group.add(propeller);
  return { group, propeller, wings };
}

function addPropellerBlur(group) {
  const blurMaterial = new THREE.MeshBasicMaterial({
    color: 0xf3e9d2, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false,
  });
  const blurDisc = new THREE.Mesh(new THREE.CircleGeometry(0.88, 32), blurMaterial);
  blurDisc.position.z = -1.88;
  blurDisc.name = 'Propeller blur disc';
  group.add(blurDisc);
  return blurDisc;
}

function buildCockpit(materials, cockpit) {
  const interior = new THREE.Group();
  interior.name = 'Cockpit interior';
  interior.visible = false;
  const dark = new THREE.MeshStandardMaterial({ color: '#12161d', roughness: 0.85 });
  const brow = new THREE.MeshStandardMaterial({ color: '#101317', roughness: 0.98 });
  const panelGray = new THREE.MeshStandardMaterial({ color: '#8f948b', roughness: 0.85 });
  const doorUpper = new THREE.MeshStandardMaterial({ color: '#525a5b', roughness: 0.95, side: THREE.DoubleSide });
  const doorLower = new THREE.MeshStandardMaterial({ color: '#434a4b', roughness: 0.95, side: THREE.DoubleSide });
  const rubber = new THREE.MeshStandardMaterial({ color: '#0c1013', roughness: 1 });
  const panelMaterial = new THREE.MeshBasicMaterial({
    map: cockpit.texture, toneMapped: false, depthTest: false, depthWrite: false,
  });

  function part(geometry, material, x, y, z, parent = interior) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  function brace(geometry, start, end, material = materials.metal) {
    const direction = end.clone().sub(start);
    const center = start.clone().lerp(end, 0.5);
    const mesh = part(geometry, material, center.x, center.y, center.z);
    mesh.scale.y = direction.length();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return mesh;
  }

  function sidewall(side) {
    const topFront = new THREE.Vector3(side * 0.79, 0.50, -1.00);
    const topRear = new THREE.Vector3(side * 0.70, 0.62, 0.45);
    const bottomFront = new THREE.Vector3(side * 0.77, -0.45, -1.04);
    const bottomRear = new THREE.Vector3(side * 0.67, -0.45, 0.45);
    const trimFront = bottomFront.clone().lerp(topFront, 0.55);
    const trimRear = bottomRear.clone().lerp(topRear, 0.55);
    function doorPanel(corners, material, name) {
      const geometry = new THREE.BufferGeometry().setFromPoints(corners);
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.computeVertexNormals();
      part(geometry, material, 0, 0, 0).name = name;
    }
    doorPanel([topFront, topRear, trimRear, trimFront], doorUpper, 'Upper door panel');
    doorPanel([trimFront, trimRear, bottomRear, bottomFront], doorLower, 'Lower door panel');
    brace(new THREE.BoxGeometry(0.022, 1, 0.025), trimFront, trimRear, dark).name = 'Door trim';
    brace(new THREE.BoxGeometry(0.07, 1, 0.07), topFront, topRear, dark).name = 'Door sill';
    brace(new THREE.BoxGeometry(0.055, 1, 0.055), topRear, bottomRear, dark).name = 'Rear door pillar';
    const handle = bottomFront.clone().lerp(bottomRear, 0.72)
      .lerp(topFront.clone().lerp(topRear, 0.72), 0.40);
    part(new THREE.BoxGeometry(0.024, 0.023, 0.087), materials.metal,
      handle.x - side * 0.015, handle.y, handle.z).name = 'Door handle';
  }

  part(new THREE.BoxGeometry(1.58, 0.78, 0.14), panelGray, 0, 0.13, -1.08);
  const instruments = part(new THREE.PlaneGeometry(1.5, 0.75), panelMaterial, 0, 0.13, -1.005);
  instruments.name = 'Instrument face';
  instruments.rotation.x = -0.10;
  // The dashboard backing intersects the tilted face, so paint the instruments over it.
  instruments.renderOrder = 1;
  part(new THREE.BoxGeometry(1.62, 0.075, 0.37), brow, 0, 0.5325, -0.975);
  part(new THREE.BoxGeometry(1.60, 0.034, 0.028), dark, 0, 0.535, -0.79).name = 'Padded brow edge';
  part(new THREE.BoxGeometry(1.54, 0.017, 0.29), rubber, 0, 0.489, -0.974).name = 'Brow underside';
  brace(new THREE.BoxGeometry(1.70, 1, 0.05),
    new THREE.Vector3(0, -0.46, -0.45), new THREE.Vector3(0, -0.24, -1.02), panelGray).name = 'Sloped panel apron';
  for (const side of [-1, 1]) {
    part(new THREE.BoxGeometry(0.075, 0.14, 0.17), panelGray, side * 0.775, -0.277, -1.01).name = 'Apron corner filler';
  }
  const console = part(new THREE.BoxGeometry(0.25, 0.26, 0.55), dark, 0.08, -0.36, -0.82);
  console.name = 'Lower centre console';
  const carpetCanvas = document.createElement('canvas');
  carpetCanvas.width = carpetCanvas.height = 64;
  const carpetContext = carpetCanvas.getContext('2d');
  const carpetGrain = carpetContext.createImageData(64, 64);
  for (let i = 0; i < carpetGrain.data.length; i += 4) {
    const grey = 236 + ((Math.imul(i / 4 + 1, 0x45d9f3b) >>> 18) % 14);
    carpetGrain.data.set([grey, grey, grey, 255], i);
  }
  carpetContext.putImageData(carpetGrain, 0, 0);
  const carpetMap = new THREE.CanvasTexture(carpetCanvas);
  carpetMap.wrapS = carpetMap.wrapT = THREE.RepeatWrapping;
  carpetMap.repeat.set(14, 18);
  const carpet = new THREE.MeshStandardMaterial({ color: '#24282d', roughness: 1, map: carpetMap });
  part(new THREE.BoxGeometry(1.7, 0.06, 2.25), carpet, 0, -0.48, -0.27).name = 'Cabin floor';
  part(new THREE.BoxGeometry(1.49, 0.13, 0.21), dark, 0, -0.43, -1.18);
  const post = new THREE.BoxGeometry(0.038, 1, 0.045);
  const seal = new THREE.BoxGeometry(0.012, 1, 0.018);
  for (const side of [-1, 1]) {
    brace(post, new THREE.Vector3(side * 0.79, 0.50, -1.00), new THREE.Vector3(side * 0.56, 1.06, -0.615), dark);
    brace(seal, new THREE.Vector3(side * 0.772, 0.50, -0.982),
      new THREE.Vector3(side * 0.543, 1.052, -0.598), rubber);
    sidewall(side);
  }
  part(new THREE.BoxGeometry(1.16, 0.038, 0.06), dark, 0, 1.06, -0.61);
  part(new THREE.BoxGeometry(1.12, 0.012, 0.018), rubber, 0, 1.038, -0.624);
  brace(new THREE.BoxGeometry(0.030, 1, 0.045),
    new THREE.Vector3(0, 0.52, -0.99), new THREE.Vector3(0, 1.06, -0.615), dark);
  for (const x of [-0.013, 0.013]) {
    brace(seal, new THREE.Vector3(x, 0.52, -0.974), new THREE.Vector3(x, 1.054, -0.601), rubber);
  }
  const checklist = new THREE.Group();
  checklist.name = 'Post-mounted checklist';
  checklist.position.set(0, 0.79, -0.768);
  checklist.rotation.x = 0.55;
  interior.add(checklist);
  part(new THREE.BoxGeometry(0.30, 0.118, 0.012), dark, 0, 0, -0.007, checklist);
  const dropShadow = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: `
      varying vec2 cardUv;
      void main() {
        cardUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec2 cardUv;
      void main() {
        vec2 edge = max(abs(cardUv - 0.5) - vec2(0.40, 0.32), 0.0);
        gl_FragColor = vec4(0.02, 0.025, 0.03, 0.40 * (1.0 - smoothstep(0.0, 0.10, length(edge))));
      }`,
  });
  part(new THREE.PlaneGeometry(0.332, 0.151), dropShadow, 0.006, -0.008, -0.021, checklist);
  part(new THREE.PlaneGeometry(0.29, 0.108),
    new THREE.MeshBasicMaterial({ map: cockpit.cardTexture, toneMapped: false }), 0, 0, 0, checklist);
  part(new THREE.BoxGeometry(0.05, 0.030, 0.06), materials.metal, 0, 0.064, -0.020, checklist).name = 'Checklist clip';

  // Compose the yoke over the instrument face because the exterior fuselage is solid.
  const yokeDepth = { depthTest: false, depthWrite: false };
  const charcoal = new THREE.MeshStandardMaterial({
    color: '#3a4048', roughness: 0.55, metalness: 0.25, ...yokeDepth,
  });
  const edge = new THREE.MeshStandardMaterial({ color: '#6a7280', roughness: 0.5, ...yokeDepth });
  const gripRubber = new THREE.MeshStandardMaterial({ color: '#252a30', roughness: 0.7, ...yokeDepth });
  const hubMetal = materials.metal.clone();
  Object.assign(hubMetal, yokeDepth);
  const bar = new THREE.Vector3(-0.49, 0.067, -0.78);
  function yokePart(geometry, material, x, y, z, name) {
    const mesh = part(geometry, material, x, y, z);
    mesh.name = name;
    mesh.renderOrder = 2;
    return mesh;
  }
  const column = brace(new THREE.CylinderGeometry(0.026, 0.032, 1, 10),
    new THREE.Vector3(-0.49, -0.115, -0.99), bar, charcoal);
  column.name = 'Yoke column';
  column.renderOrder = 2;
  yokePart(new THREE.BoxGeometry(0.30, 0.032, 0.036), charcoal, bar.x, bar.y, bar.z, 'Yoke crossbar');
  yokePart(new THREE.BoxGeometry(0.264, 0.005, 0.010), edge, bar.x, bar.y + 0.016, bar.z + 0.012, 'Yoke edge');
  const hub = yokePart(new THREE.CylinderGeometry(0.034, 0.034, 0.037, 16),
    hubMetal, bar.x, bar.y, bar.z + 0.017, 'Yoke hub');
  hub.rotation.x = Math.PI / 2;
  const gripGeometry = new THREE.CapsuleGeometry(0.017, 0.051, 4, 8);
  for (const side of [-1, 1]) {
    const grip = yokePart(gripGeometry, gripRubber, bar.x + side * 0.146, bar.y, bar.z + 0.010, 'Yoke grip');
    grip.rotation.x = -Math.PI / 6;
  }
  return interior;
}

export async function buildSeaplane() {
  const materials = aircraftMaterials();
  const group = new THREE.Group();
  group.name = 'Duskmail seaplane';
  let propeller = null;
  let spinners = [];
  let wings = [];

  try {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.min.js');
    const gltf = await new GLTFLoader().loadAsync('./assets/seaplane.glb');
    gltf.scene.traverse((part) => {
      if (part.isMesh && Object.hasOwn(materials, part.material.name)) {
        part.material = materials[part.material.name];
      }
      if (part.name === 'Propeller' || part.name === 'PropellerSpinner') spinners.push(part);
      if (part.name.startsWith('Wing')) wings.push(part);
    });
    if (spinners.length !== 2) throw new Error('Missing seaplane propeller parts');
    group.add(gltf.scene);
  } catch {
    const primitive = buildPrimitiveSeaplane(materials);
    group.add(primitive.group);
    propeller = primitive.propeller;
    spinners = [propeller];
    wings = primitive.wings;
  }
  const blurDisc = addPropellerBlur(group);
  const canopy = group.getObjectByName('Canopy');
  const cockpit = createCockpitTexture();
  const interior = buildCockpit(materials, cockpit);
  group.add(interior);
  group.traverse((part) => { if (part.isMesh) part.castShadow = true; });
  blurDisc.castShadow = false;
  interior.traverse((part) => { if (part.isMesh) part.castShadow = false; });

  function spinPropeller(dt, throttle) {
    const rotation = dt * (AIRCRAFT.propellerIdle + throttle * AIRCRAFT.propellerPower);
    for (const spinner of spinners) {
      spinner.rotation.z = (spinner.rotation.z + rotation) % (2 * Math.PI);
    }
  }

  function setCockpitVisible(visible) {
    interior.visible = visible;
    // The opaque exterior canopy would cover the view from the pilot's eye.
    if (canopy) canopy.visible = !visible;
    for (const spinner of spinners) spinner.visible = !visible;
    for (const wing of wings) wing.visible = !visible;
    blurDisc.material.opacity = visible ? 0.05 : 0.15;
    blurDisc.material.color.setHex(visible ? 0x24262a : 0xf3e9d2);
  }

  function updateCockpit(flight, position, course) {
    if (interior.visible) cockpit.draw(flight, position, course);
  }

  return { group, propeller, spinPropeller, setCockpitVisible, updateCockpit };
}

export function createFlight() {
  const state = {
    position: new THREE.Vector3(),
    heading: 0, pitch: 0, roll: 0,
    speed: AIRCRAFT.minSpeed, throttle: AIRCRAFT.initialThrottle,
    verticalSpeed: 0, grounded: false, crashed: false, landed: false,
    aoa: 0, stall: 0, stallWarn: false, onWater: false, touchdownSurface: null,
    fuel: 1, flameout: false, engineThrottle: AIRCRAFT.initialThrottle,
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
    state.fuel = 1;
    state.flameout = false;
    state.engineThrottle = parked ? 0 : AIRCRAFT.initialThrottle;
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
    state.engineThrottle = state.flameout ? 0 : state.throttle;
    if (!state.flameout) {
      const burnRate = (FUEL.idleFraction + (1 - FUEL.idleFraction) * state.throttle) / FUEL.capacitySeconds;
      state.fuel = Math.max(0, state.fuel - burnRate * dt);
      if (state.fuel <= 0) { state.flameout = true; state.engineThrottle = 0; }
    }
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

    const throttleSpeed = THREE.MathUtils.lerp(AIRCRAFT.minSpeed, AIRCRAFT.maxSpeed, state.engineThrottle);
    const targetSpeed = state.grounded
      ? Math.max(0, (state.engineThrottle - AIRCRAFT.takeoffThrottle) / (1 - AIRCRAFT.takeoffThrottle)) * AIRCRAFT.maxSpeed
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
