// Generates the shared elevation grid and builds the atoll scenery.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.min.js';
import { COURSE, PALETTE, RUNWAY, SCENERY, SHADOWS, TERRAIN, WATERLANE, WORLD, WORLD_SEED } from './config.js';
import { createRandom, fbm, smoothstep, valueNoise } from './random.js';

const half = WORLD.size / 2;
const last = WORLD.grid - 1;
const spacing = WORLD.size / last;
const centerX = RUNWAY.nx * half;
const centerZ = RUNWAY.nz * half;
const radialLength = Math.hypot(RUNWAY.nx, RUNWAY.nz);
const tangentX = RUNWAY.nz / radialLength;
const tangentZ = -RUNWAY.nx / radialLength;
const halfLength = RUNWAY.length / 2;
const halfWidth = RUNWAY.width / 2;
export const runwayCenter = new THREE.Vector3(centerX, RUNWAY.elevation, centerZ);
export const runwayTangent = new THREE.Vector3(tangentX, 0, tangentZ);
export const runwayHeading = Math.atan2(tangentX, -tangentZ);
export const waterlaneCenter = new THREE.Vector3(WATERLANE.nx * half, WORLD.seaLevel, WATERLANE.nz * half);
export const waterlaneTangent = new THREE.Vector3(WATERLANE.nz, 0, -WATERLANE.nx).normalize();
export const waterlaneHeading = Math.atan2(waterlaneTangent.x, -waterlaneTangent.z);
export { WORLD };

export function courseRingPositions(heightAt, seed = WORLD_SEED) {
  const random = createRandom(seed + COURSE.seedOffset);
  const interval = 2 * Math.PI / COURSE.ringCount;
  const startAngle = Math.atan2(runwayCenter.z, runwayCenter.x);
  return Array.from({ length: COURSE.ringCount }, (_, i) => {
    const angle = startAngle + (i + 0.85) * interval + (random() - 0.5) * COURSE.angleJitter;
    const radius = THREE.MathUtils.lerp(COURSE.radialMin, COURSE.radialMax, random()) * WORLD.size / 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const clearance = THREE.MathUtils.lerp(COURSE.clearanceMin, COURSE.clearanceMax, random());
    return new THREE.Vector3(x, Math.max(heightAt(x, z), WORLD.seaLevel) + clearance, z);
  });
}

export function isOnWaterLane(x, z, margin = 0) {
  const dx = x - waterlaneCenter.x;
  const dz = z - waterlaneCenter.z;
  const along = dx * waterlaneTangent.x + dz * waterlaneTangent.z;
  const across = -dx * waterlaneTangent.z + dz * waterlaneTangent.x;
  return Math.abs(along) <= WATERLANE.length / 2 + margin
    && Math.abs(across) <= WATERLANE.width / 2 + margin;
}

let heightGrid;
let gridSeed;

function localRunwayX(dx, dz) {
  return dx * tangentX + dz * tangentZ;
}

function localRunwayZ(dx, dz) {
  return -dx * tangentZ + dz * tangentX;
}

export function isOnRunway(x, z) {
  const dx = x - centerX;
  const dz = z - centerZ;
  return Math.abs(localRunwayX(dx, dz)) <= halfLength
    && Math.abs(localRunwayZ(dx, dz)) <= halfWidth;
}

export function buildHeightGrid(seed = WORLD_SEED) {
  const grid = new Float32Array(WORLD.grid * WORLD.grid);
  for (let gy = 0; gy <= last; gy++) {
    const ny = gy / last - 0.5;
    const z = ny * WORLD.size;
    const v = gy / last * TERRAIN.frequency;
    for (let gx = 0; gx <= last; gx++) {
      const nx = gx / last - 0.5;
      const x = nx * WORLD.size;
      const u = gx / last * TERRAIN.frequency;
      const d = Math.hypot(nx, ny) * 2;
      const ring = smoothstep(TERRAIN.innerStart, TERRAIN.innerEnd, d)
        * (1 - smoothstep(TERRAIN.outerStart, TERRAIN.outerEnd, d));
      const elevation = Math.pow(fbm(u, v, seed), TERRAIN.exponent) * ring * WORLD.peakScale
        + WORLD.baseOffset;
      const dx = x - centerX;
      const dz = z - centerZ;
      const outsideX = Math.max(0, Math.abs(localRunwayX(dx, dz)) - halfLength);
      const outsideZ = Math.max(0, Math.abs(localRunwayZ(dx, dz)) - halfWidth);
      const blend = smoothstep(0, RUNWAY.blend, Math.hypot(outsideX, outsideZ));
      grid[gy * WORLD.grid + gx] = RUNWAY.elevation + (elevation - RUNWAY.elevation) * blend;
    }
  }
  return grid;
}

function sampleGrid(grid, x, z) {
  const gx = THREE.MathUtils.clamp((x / WORLD.size + 0.5) * last, 0, last);
  const gz = THREE.MathUtils.clamp((z / WORLD.size + 0.5) * last, 0, last);
  const left = Math.floor(gx);
  const top = Math.floor(gz);
  const right = Math.min(left + 1, last);
  const bottom = Math.min(top + 1, last);
  const a = THREE.MathUtils.lerp(grid[top * WORLD.grid + left], grid[top * WORLD.grid + right], gx - left);
  const b = THREE.MathUtils.lerp(grid[bottom * WORLD.grid + left], grid[bottom * WORLD.grid + right], gx - left);
  return THREE.MathUtils.lerp(a, b, gz - top);
}

export function heightAt(x, z) {
  if (!heightGrid) {
    heightGrid = buildHeightGrid();
    gridSeed = WORLD_SEED;
  }
  return sampleGrid(heightGrid, x, z);
}

const shadowLights = new WeakMap();

function waterNormalMap() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  const heights = new Float32Array(size * size);
  function tiledNoise(u, v, frequency, seed) {
    const x = u * frequency;
    const y = v * frequency;
    const blendX = smoothstep(0, 1, u);
    const blendY = smoothstep(0, 1, v);
    const a = THREE.MathUtils.lerp(valueNoise(x, y, seed), valueNoise(x - frequency, y, seed), blendX);
    const b = THREE.MathUtils.lerp(valueNoise(x, y - frequency, seed),
      valueNoise(x - frequency, y - frequency, seed), blendX);
    return THREE.MathUtils.lerp(a, b, blendY);
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      heights[y * size + x] = tiledNoise(x / size, y / size, 2, 181)
        + tiledNoise(x / size, y / size, 7, 182) * 0.32;
    }
  }
  const height = (x, y) => heights[((y + size) % size) * size + (x + size) % size];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nw = height(x - 1, y - 1);
      const ne = height(x + 1, y - 1);
      const sw = height(x - 1, y + 1);
      const se = height(x + 1, y + 1);
      const dx = (ne + 2 * height(x + 1, y) + se - nw - 2 * height(x - 1, y) - sw) * 8;
      const dy = (sw + 2 * height(x, y + 1) + se - nw - 2 * height(x, y - 1) - ne) * 8;
      const normal = 1 / Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      image.data[i] = (-dx * normal * 0.5 + 0.5) * 255;
      image.data[i + 1] = (dy * normal * 0.5 + 0.5) * 255;
      image.data[i + 2] = (normal * 0.5 + 0.5) * 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(260, 260);
  return texture;
}

function updateShadows(scene, position) {
  const light = shadowLights.get(scene);
  if (!light) return;
  const { sun, target, direction } = light;
  sun.position.copy(position).addScaledVector(direction, SHADOWS.distance);
  target.position.copy(position);
  sun.updateMatrixWorld();
  target.updateMatrixWorld();
}

function addSkyAndSea(scene, normalMap) {
  const elevation = THREE.MathUtils.degToRad(SCENERY.sunElevation);
  const azimuth = THREE.MathUtils.degToRad(SCENERY.sunAzimuth);
  const sunDirection = new THREE.Vector3(
    Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation),
    Math.sin(azimuth) * Math.cos(elevation),
  );
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(SCENERY.radius, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        zenith: { value: new THREE.Color(PALETTE.skyZenith) },
        mid: { value: new THREE.Color(PALETTE.skyMid) },
        horizon: { value: new THREE.Color(PALETTE.horizon) },
        sun: { value: new THREE.Color(PALETTE.sun) },
        sunDirection: { value: sunDirection },
      },
      vertexShader: `
        varying vec3 vDirection;
        void main() {
          vDirection = position - cameraPosition;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 zenith, mid, horizon, sun, sunDirection;
        varying vec3 vDirection;
        void main() {
          vec3 direction = normalize(vDirection);
          float altitude = max(direction.y, 0.0);
          vec3 color = mix(horizon, mid, smoothstep(0.015, 0.30, altitude));
          color = mix(color, zenith, smoothstep(0.18, 0.92, altitude));
          float towardSun = max(dot(direction, sunDirection), 0.0);
          color = mix(color, sun, 0.55 * pow(towardSun, 12.0));
          float aureole = 0.45 * pow(towardSun, 105.0) + 0.62 * pow(towardSun, 680.0);
          float disc = smoothstep(0.99964, 0.99973, towardSun);
          color += sun * aureole + vec3(3.6, 2.22, 1.1) * disc;
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }),
  );
  sky.name = 'Sunset sky';
  sky.renderOrder = -10;
  scene.add(sky);
  scene.fog = new THREE.Fog(PALETTE.horizon, SCENERY.fogNear, SCENERY.fogFar);
  const sun = new THREE.DirectionalLight(PALETTE.sun, SCENERY.sunlight);
  sun.position.copy(sunDirection);
  if (SHADOWS.enabled) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(SHADOWS.mapSize, SHADOWS.mapSize);
    Object.assign(sun.shadow.camera, {
      left: -SHADOWS.box, right: SHADOWS.box, top: SHADOWS.box, bottom: -SHADOWS.box,
      near: 10, far: 600,
    });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = SHADOWS.bias;
    sun.shadow.normalBias = SHADOWS.normalBias;
    scene.add(sun.target);
    shadowLights.set(scene, { sun, target: sun.target, direction: sunDirection });
  }
  scene.add(sun, new THREE.HemisphereLight(PALETTE.ambientSky, PALETTE.ambientGround, SCENERY.ambient));

  const sea = new THREE.Mesh(
    new THREE.CircleGeometry(SCENERY.radius, 128),
    new THREE.MeshStandardMaterial({
      color: PALETTE.sea, emissive: PALETTE.seaEmissive, roughness: SCENERY.seaRoughness,
      normalMap, normalScale: new THREE.Vector2(0.35, 0.35),
    }),
  );
  sea.name = 'Lagoon and open sea';
  sea.receiveShadow = true;
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = WORLD.seaLevel;
  scene.add(sea);
}

function addShallows(scene, sample, waterTexture) {
  const geometry = new THREE.PlaneGeometry(5600, 5600, 120, 120);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  const foam = new THREE.Color(PALETTE.foam);
  const turquoise = new THREE.Color(PALETTE.turquoise);
  const lagoon = new THREE.Color(PALETTE.lagoon);
  const sea = new THREE.Color(PALETTE.sea);
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const depth = -sample(positions.getX(i), positions.getZ(i));
    if (depth <= 0.35) color.copy(foam).lerp(turquoise, smoothstep(0, 0.35, depth));
    else if (depth <= 3.6) color.copy(turquoise).lerp(lagoon, smoothstep(0.35, 3.6, depth));
    else color.copy(lagoon).lerp(sea, smoothstep(3.6, 6.4, depth));
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const normalMap = waterTexture.clone();
  normalMap.repeat.set(140, 140);
  const shallows = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.28, metalness: 0,
    normalMap, normalScale: new THREE.Vector2(0.22, 0.22),
  }));
  shallows.name = 'Lagoon shallows';
  shallows.receiveShadow = true;
  shallows.position.y = WORLD.seaLevel + 0.05;
  scene.add(shallows);
}

function slopeAt(sample, x, z) {
  return Math.hypot(
    sample(x + spacing, z) - sample(x - spacing, z),
    sample(x, z + spacing) - sample(x, z - spacing),
  ) / (2 * spacing);
}

function addTerrain(scene, grid, seed) {
  const geometry = new THREE.PlaneGeometry(WORLD.size, WORLD.size, last, last);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  const lowGrass = new THREE.Color(PALETTE.grassLow);
  const highGrass = new THREE.Color(PALETTE.grassHigh);
  const brightGrass = new THREE.Color(PALETTE.grassBright);
  const forest = new THREE.Color(PALETTE.forest);
  const rock = new THREE.Color(PALETTE.rock);
  const warmRock = new THREE.Color(PALETTE.rockWarm);
  const color = new THREE.Color();
  const stone = new THREE.Color();
  for (let i = 0; i < positions.count; i++) positions.setY(i, grid[i]);
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const y = grid[i];
    const broad = valueNoise(x / 175, z / 175, seed + 117);
    const detail = valueNoise(x / 46, z / 46, seed + 118);
    const patch = valueNoise(x / 330, z / 330, seed + 131);
    const micro = valueNoise(x / 15, z / 15, seed + 119);
    const dryness = smoothstep(18, 76, y + (broad - 0.5) * 48);
    const steepness = 1 - normals.getY(i);
    const exposed = Math.max(smoothstep(0.07, 0.34, steepness), smoothstep(73, 115, y));
    stone.copy(rock).lerp(warmRock, broad);
    const meadow = smoothstep(2, 16, y) * (1 - dryness) * 0.5;
    const forestMask = smoothstep(0.54, 0.72, patch) * smoothstep(4, 10, y)
      * (1 - smoothstep(55, 75, y)) * (1 - exposed);
    color.copy(lowGrass).lerp(highGrass, dryness).lerp(brightGrass, meadow)
      .lerp(forest, forestMask * 0.75).lerp(stone, exposed)
      .multiplyScalar(0.88 + broad * 0.14 + detail * 0.08 + micro * 0.13);
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.biomeFoam = { value: new THREE.Color(PALETTE.foam) };
    shader.uniforms.biomeSand = { value: new THREE.Color(PALETTE.sand) };
    shader.uniforms.biomeRock = { value: new THREE.Color(PALETTE.rock) };
    shader.uniforms.biomeWarmRock = { value: new THREE.Color(PALETTE.rockWarm) };
    shader.uniforms.biomePale = { value: new THREE.Color(PALETTE.snow) };
    shader.vertexShader = `
      varying vec3 vTerrainWorld;
      ${shader.vertexShader}
    `.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vTerrainWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    `);
    shader.fragmentShader = `
      varying vec3 vTerrainWorld;
      uniform vec3 biomeFoam, biomeSand, biomeRock, biomeWarmRock, biomePale;

      float terrainHash(vec2 p) {
        vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
        q += dot(q, q.yzx + 33.33);
        return fract((q.x + q.y) * q.z);
      }

      float terrainNoise(vec2 p) {
        vec2 cell = floor(p);
        vec2 w = fract(p);
        w *= w * (3.0 - 2.0 * w);
        return mix(
          mix(terrainHash(cell), terrainHash(cell + vec2(1, 0)), w.x),
          mix(terrainHash(cell + vec2(0, 1)), terrainHash(cell + vec2(1, 1)), w.x), w.y);
      }
      ${shader.fragmentShader}
    `.replace('#include <normal_fragment_begin>', `
      #include <normal_fragment_begin>
      vec2 ground = mat2(0.87, -0.49, 0.49, 0.87) * vTerrainWorld.xz;
      float broadGrain = terrainNoise(ground / 13.9 + 31.7);
      float fineGrain = terrainNoise(ground / 2.65 - 7.8);
      float dither = (broadGrain - 0.5) * 0.86 + (fineGrain - 0.5) * 0.36;
      float altitude = vTerrainWorld.y;
      float upNormal = inverseTransformDirection(normal, viewMatrix).y;
      float rock = 1.0 - smoothstep(${TERRAIN.steepNormalY} - 0.08,
        ${TERRAIN.steepNormalY} + 0.08, upNormal + dither * 0.08);
      vec3 stone = mix(biomeRock, biomeWarmRock,
        smoothstep(${TERRAIN.warmRockStart.toFixed(1)} - 8.0, ${TERRAIN.warmRockStart.toFixed(1)} + 8.0, altitude));
      vec3 groundColor = mix(diffuseColor.rgb, stone, 0.92 * rock);
      float beach = 1.0 - smoothstep(${TERRAIN.sandEnd} - 0.45, ${TERRAIN.sandEnd} + 0.45, altitude + dither);
      float foam = 1.0 - smoothstep(${TERRAIN.foamEnd} - 0.23, ${TERRAIN.foamEnd} + 0.23, altitude + dither * 0.65);
      float pale = smoothstep(${TERRAIN.paleStart.toFixed(1)} - 1.0,
        ${TERRAIN.paleStart.toFixed(1)} + 1.0, altitude + dither);
      groundColor = mix(groundColor, biomeSand, beach);
      groundColor = mix(groundColor, biomeFoam, foam * 0.75);
      groundColor = mix(groundColor, biomePale, pale);
      diffuseColor.rgb = groundColor * (1.0 + (broadGrain - 0.5) * 0.20 + (fineGrain - 0.5) * 0.11);
    `);
  };
  const terrain = new THREE.Mesh(geometry, material);
  terrain.name = 'Atoll terrain';
  terrain.receiveShadow = true;
  scene.add(terrain);
}

function place(group, geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function addRunway(scene) {
  const runway = new THREE.Group();
  runway.name = 'Shore strip';
  runway.position.set(centerX, RUNWAY.elevation + SCENERY.runwayLift, centerZ);
  runway.rotation.y = -Math.atan2(tangentZ, tangentX);
  const asphalt = new THREE.MeshStandardMaterial({ color: PALETTE.asphalt, roughness: 0.93 });
  const chalk = new THREE.MeshStandardMaterial({ color: PALETTE.chalk });
  const glow = new THREE.MeshStandardMaterial({
    color: PALETTE.edgeLight, emissive: PALETTE.edgeLight, emissiveIntensity: 2,
  });
  const slabHeight = 0.1;
  place(runway, new THREE.BoxGeometry(RUNWAY.length, slabHeight, RUNWAY.width),
    asphalt, 0, -slabHeight / 2, 0);
  const centerline = new THREE.MeshBasicMaterial({ color: PALETTE.centerline });
  const dash = new THREE.BoxGeometry(SCENERY.dashLength, 0.03, SCENERY.dashWidth);
  const threshold = new THREE.BoxGeometry(10, 0.03, 1.75);
  const bulb = new THREE.SphereGeometry(0.45, 8, 6);
  for (let x = 0; x < halfLength - 22; x += SCENERY.dashSpacing) {
    place(runway, dash, centerline, x, 0.02, 0);
    if (x > 0) place(runway, dash, centerline, -x, 0.02, 0);
  }
  for (const end of [-1, 1]) {
    for (let z = -21; z <= 21; z += 6) {
      place(runway, threshold, chalk, end * (halfLength - 11), 0.02, z);
    }
    for (let x = -halfLength + 8; x <= halfLength; x += SCENERY.lightSpacing) {
      place(runway, bulb, glow, x, 0.45, end * (halfWidth - 0.8));
    }
  }
  const pole = new THREE.MeshStandardMaterial({ color: PALETTE.chalk });
  const sock = new THREE.MeshStandardMaterial({ color: PALETTE.windsock });
  const poleX = halfLength - 48;
  const poleZ = halfWidth - 4;
  place(runway, new THREE.CylinderGeometry(0.15, 0.22, 7, 8), pole, poleX, 3.5, poleZ);
  const cone = place(runway, new THREE.ConeGeometry(0.76, 3.6, 12), sock, poleX + 1.65, 6.65, poleZ);
  cone.rotation.z = -1.35;
  scene.add(runway);
}

function addWaterLane(scene, seed) {
  const lane = new THREE.Group();
  lane.name = 'Water lane';
  lane.position.copy(waterlaneCenter);
  lane.rotation.y = -Math.atan2(waterlaneTangent.z, waterlaneTangent.x);
  const random = createRandom(seed + 55);
  const base = new THREE.CylinderGeometry(0.9, 1.1, 0.5, 12);
  const body = new THREE.ConeGeometry(0.85, 1.6, 10);
  const lamp = new THREE.SphereGeometry(0.23, 8, 6);
  const floatMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.metal });
  const buoyMaterial = new THREE.MeshStandardMaterial({
    color: PALETTE.buoy, emissive: PALETTE.buoy, emissiveIntensity: 0.5,
  });
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: PALETTE.edgeLight, emissive: PALETTE.edgeLight, emissiveIntensity: 2,
  });

  function addBuoy(along, across, end = false) {
    const buoy = new THREE.Group();
    buoy.position.set(along, (random() - 0.5) * 0.16, across);
    buoy.rotation.y = random() * Math.PI * 2;
    place(buoy, base, floatMaterial, 0, 0, 0);
    place(buoy, body, buoyMaterial, 0, 1.05, 0);
    if (end) {
      buoy.scale.setScalar(1.5);
      place(buoy, lamp, lampMaterial, 0, 1.85, 0);
    }
    lane.add(buoy);
  }

  const end = WATERLANE.length / 2;
  for (const side of [-1, 1]) {
    const across = side * WATERLANE.width / 2;
    for (let along = -end + WATERLANE.buoySpacing / 2; along < end; along += WATERLANE.buoySpacing) {
      addBuoy(along, across);
    }
    addBuoy(-end, across, true);
    addBuoy(end, across, true);
  }
  scene.add(lane);
}

function addTrees(scene, sample, random, excluded) {
  const seed = gridSeed;
  const canopy = mergeGeometries([
    new THREE.ConeGeometry(1, 1.6, 7).translate(0, 0.8, 0),
    new THREE.ConeGeometry(0.68, 1.3, 7).translate(0, 1.95, 0),
  ]);
  const trees = new THREE.InstancedMesh(
    canopy,
    new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }),
    SCENERY.treeCount,
  );
  trees.name = 'Atoll trees';
  trees.castShadow = true;
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.13, 0.2, 1, 5),
    new THREE.MeshStandardMaterial({ color: '#6b4a2f', flatShading: true, roughness: 1 }),
    SCENERY.treeCount,
  );
  trunks.name = 'Atoll tree trunks';
  trunks.castShadow = true;
  const tree = new THREE.Object3D();
  const shade = new THREE.Color(PALETTE.tree);
  const sun = new THREE.Color(PALETTE.treeSun);
  const color = new THREE.Color();
  let count = 0;
  for (let attempt = 0; attempt < SCENERY.treeAttempts && count < SCENERY.treeCount; attempt++) {
    const x = (random() - 0.5) * WORLD.size;
    const z = (random() - 0.5) * WORLD.size;
    const y = sample(x, z);
    if (y < SCENERY.treeMinHeight || y > SCENERY.treeMaxHeight || slopeAt(sample, x, z) > SCENERY.treeMaxSlope) continue;
    if (excluded(x, z, SCENERY.treeRunwayBuffer)) continue;
    const cluster = valueNoise(x / 300, z / 300, seed + 131);
    if (cluster <= 0.52 && random() >= 0.15) continue;
    const size = SCENERY.treeMinSize + random() * SCENERY.treeSizeRange;
    const angle = random() * Math.PI * 2;
    tree.position.set(x, y + size * 0.16, z);
    tree.scale.set(size * 0.14, size * 0.34, size * 0.14);
    tree.rotation.set(Math.sin(angle) * 0.10, angle, Math.cos(angle) * 0.08);
    tree.updateMatrix();
    trunks.setMatrixAt(count, tree.matrix);
    tree.position.set(x, y + size * 0.30, z);
    tree.scale.setScalar(size * 0.30);
    tree.rotation.set(0, angle, 0);
    tree.updateMatrix();
    trees.setMatrixAt(count, tree.matrix);
    trees.setColorAt(count, color.copy(shade).lerp(sun, random()));
    count++;
  }
  trees.count = count;
  trunks.count = count;
  scene.add(trees, trunks);
}

function isNearRunway(x, z, margin) {
  const dx = x - centerX;
  const dz = z - centerZ;
  return Math.abs(localRunwayX(dx, dz)) <= halfLength + margin
    && Math.abs(localRunwayZ(dx, dz)) <= halfWidth + margin;
}

function addPalms(scene, sample, random, excluded) {
  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.12, 0.23, 1, 5),
    new THREE.MeshStandardMaterial({ color: PALETTE.rockWarm, flatShading: true }),
    SCENERY.palmCount,
  );
  const leaves = [];
  for (let i = 0; i < 7; i++) {
    const angle = i / 7 * Math.PI * 2;
    const x = Math.cos(angle);
    const z = Math.sin(angle);
    const mid = [x * 1.45, 0.38, z * 1.45];
    const edgeA = [mid[0] - z * 0.37, 0.04, mid[2] + x * 0.37];
    const edgeB = [mid[0] + z * 0.37, 0.04, mid[2] - x * 0.37];
    const root = [0, 0, 0];
    const tip = [x * 2.65, -0.62, z * 2.65];
    leaves.push(...root, ...edgeA, ...mid, ...root, ...mid, ...edgeB,
      ...mid, ...edgeA, ...tip, ...mid, ...tip, ...edgeB);
  }
  const fronds = new THREE.BufferGeometry();
  fronds.setAttribute('position', new THREE.Float32BufferAttribute(leaves, 3));
  fronds.computeVertexNormals();
  const crowns = new THREE.InstancedMesh(fronds, new THREE.MeshStandardMaterial({
    side: THREE.DoubleSide, roughness: 0.92, flatShading: true,
  }), SCENERY.palmCount);
  trunk.name = 'Palm trunks';
  crowns.name = 'Palm crowns';
  trunk.castShadow = crowns.castShadow = true;
  const transform = new THREE.Object3D();
  const shade = new THREE.Color(PALETTE.tree);
  const gold = new THREE.Color(PALETTE.treeSun);
  const color = new THREE.Color();
  let count = 0;
  for (let attempt = 0; attempt < SCENERY.treeAttempts && count < SCENERY.palmCount; attempt++) {
    const x = (random() - 0.5) * WORLD.size;
    const z = (random() - 0.5) * WORLD.size;
    const y = sample(x, z);
    if (y < 4.5 || y > 25 || slopeAt(sample, x, z) > 0.27 || excluded(x, z, 48)) continue;
    const height = 4 + random() * 7;
    const crownSize = 0.8 + random() * 0.55;
    const heading = random() * Math.PI * 2;
    const lean = (random() - 0.5) * 0.32;
    transform.position.set(x, y + height / 2 - 0.24, z);
    transform.rotation.set(0, heading, lean, 'YXZ');
    transform.scale.set(crownSize, height, crownSize);
    transform.updateMatrix();
    trunk.setMatrixAt(count, transform.matrix);
    const top = new THREE.Vector3(0, 0.5, 0).applyMatrix4(transform.matrix);
    transform.position.copy(top);
    transform.scale.set(crownSize, crownSize, crownSize);
    transform.updateMatrix();
    crowns.setMatrixAt(count, transform.matrix);
    crowns.setColorAt(count, color.copy(shade).lerp(gold, random()));
    count++;
  }
  trunk.count = crowns.count = count;
  scene.add(trunk, crowns);
}

function addRocks(scene, sample, random, excluded) {
  const rocks = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }),
    SCENERY.rockCount,
  );
  rocks.name = 'Shore and slope rocks';
  rocks.castShadow = true;
  const rock = new THREE.Object3D();
  const cool = new THREE.Color(PALETTE.rock);
  const warm = new THREE.Color(PALETTE.rockWarm);
  const color = new THREE.Color();
  let count = 0;
  for (let attempt = 0; attempt < SCENERY.rockAttempts && count < SCENERY.rockCount; attempt++) {
    const x = (random() - 0.5) * WORLD.size;
    const z = (random() - 0.5) * WORLD.size;
    const y = sample(x, z);
    const onShore = y >= SCENERY.rockMinHeight && y <= 2.5;
    const onSlope = y >= 0.5 && y <= SCENERY.rockMaxHeight && slopeAt(sample, x, z) > SCENERY.rockMinSlope;
    if ((!onShore && !onSlope) || excluded(x, z, 40)) continue;
    const size = 0.8 + random() * 2.6;
    rock.position.set(x, y + size * 0.25, z);
    const squash = random();
    rock.scale.set(size * (0.82 + squash * 0.28), size * (0.55 + squash * 0.31), size);
    rock.rotation.set((random() - 0.5) * 0.6, random() * Math.PI * 2, (random() - 0.5) * 0.6);
    rock.updateMatrix();
    rocks.setMatrixAt(count, rock.matrix);
    rocks.setColorAt(count, color.copy(cool).lerp(warm, random()));
    count++;
  }
  rocks.count = count;
  scene.add(rocks);
}

function addStations(scene, sample) {
  const group = new THREE.Group();
  group.name = 'Mail stations';
  const wall = new THREE.MeshStandardMaterial({ color: PALETTE.house });
  const roof = new THREE.MeshStandardMaterial({ color: PALETTE.roof });
  const door = new THREE.MeshStandardMaterial({ color: PALETTE.canopy });
  const walls = new THREE.BoxGeometry(16, 8, 12);
  const gable = new THREE.CylinderGeometry(8, 8, 18, 3);
  gable.rotateY(Math.PI / 2);
  gable.rotateZ(Math.PI / 2);
  const doorway = new THREE.BoxGeometry(2.4, 4.1, 0.22);
  for (const along of [-55, -19, 17]) {
    const side = 65;
    const x = centerX + along * tangentX - side * tangentZ;
    const z = centerZ + along * tangentZ + side * tangentX;
    const station = new THREE.Group();
    station.position.set(x, sample(x, z) - 1.2, z);
    station.rotation.y = -Math.atan2(tangentZ, tangentX);
    place(station, walls, wall, 0, 4, 0);
    place(station, gable, roof, 0, 11.8, 0);
    place(station, doorway, door, 0, 3.1, -6);
    group.add(station);
  }
  scene.add(group);
  return group;
}

function addHouses(scene, sample, random) {
  const village = new THREE.Group();
  village.name = 'Village houses';
  const wallColor = new THREE.Color(PALETTE.house);
  const wallTint = new THREE.Color('#d9b77c');
  const roofs = ['#873e39', '#5d6e8c', '#a8642f', '#4f7a5a', '#77628f', '#80554a', '#bd8355'].map(
    (color) => new THREE.MeshStandardMaterial({ color }),
  );
  const doorway = new THREE.BoxGeometry(1.55, 2.45, 0.18);
  const door = new THREE.MeshStandardMaterial({ color: PALETTE.canopy });
  for (let attempt = 0; attempt < 250 && village.children.length < SCENERY.houseCount; attempt++) {
    const along = (random() - 0.5) * 520;
    const side = -(95 + random() * 55);
    const x = centerX + along * tangentX - side * tangentZ;
    const z = centerZ + along * tangentZ + side * tangentX;
    const y = sample(x, z);
    if (y <= 3 || slopeAt(sample, x, z) >= 0.25 || isNearRunway(x, z, 30)) continue;
    if (village.children.some((house) => Math.hypot(house.position.x - x, house.position.z - z) < 18)) continue;

    const width = 8 + random() * 7;
    const height = 4.6 + random() * 3.5;
    const depth = 7 + random() * 5;
    const house = new THREE.Group();
    house.position.set(x, y - 0.65, z);
    house.rotation.y = -Math.atan2(tangentZ, tangentX) + (random() - 0.5) * 0.24;
    const wall = new THREE.MeshStandardMaterial({ color: wallColor.clone().lerp(wallTint, random()) });
    const roof = roofs[Math.floor(random() * roofs.length)];
    const gable = new THREE.CylinderGeometry(1, 1, width + 1.2, 3);
    gable.rotateY(Math.PI / 2);
    gable.rotateZ(Math.PI / 2);
    gable.scale(1, 2.6, (depth + 1.1) / Math.sqrt(3));
    place(house, new THREE.BoxGeometry(width, height, depth), wall, 0, height / 2, 0);
    place(house, gable, roof, 0, height + 1.22, 0);
    place(house, doorway, door, 0, 1.85, depth / 2);
    village.add(house);
  }
  scene.add(village);
  return village;
}

function addClouds(scene, random) {
  const clouds = new THREE.Group();
  clouds.name = 'Sunset clouds';
  const blob = new THREE.IcosahedronGeometry(1, 1);
  const top = new THREE.MeshLambertMaterial({
    color: PALETTE.cloud, flatShading: true, emissive: '#795043',
  });
  const shade = new THREE.MeshLambertMaterial({
    color: PALETTE.cloudShade, flatShading: true, emissive: '#854729',
  });
  for (let index = 0; index < SCENERY.cloudCount; index++) {
    const cloud = new THREE.Group();
    const angle = random() * Math.PI * 2;
    const radius = 500 + random() * 2000;
    cloud.position.set(Math.cos(angle) * radius, 470 + random() * 390, Math.sin(angle) * radius);
    const count = 3 + Math.floor(random() * 4);
    for (let i = 0; i < count; i++) {
      const x = (random() - 0.5) * 76;
      const y = i === 0 ? -4 : random() * 8 - 4;
      const z = (random() - 0.5) * 76;
      const puff = place(cloud, blob, i === 0 ? shade : top, x, y, z);
      puff.scale.set(26 + random() * 38, 7 + random() * 5, 20 + random() * 18);
    }
    clouds.add(cloud);
  }
  scene.add(clouds);
}

function addDock(scene, sample, village) {
  const shore = new THREE.Vector3();
  const candidate = new THREE.Vector3();
  const towardWater = new THREE.Vector3(tangentZ, 0, -tangentX);
  let nearest = 780;
  for (const house of village.children) {
    for (let distance = 3; distance < nearest; distance += 3) {
      candidate.copy(house.position).setY(WORLD.seaLevel).addScaledVector(towardWater, distance);
      if (sample(candidate.x, candidate.z) > WORLD.seaLevel) continue;
      if (!isOnWaterLane(candidate.x, candidate.z, 65)) {
        shore.copy(candidate);
        nearest = distance;
      }
      break;
    }
  }
  if (nearest === 780) return;

  const dock = new THREE.Group();
  dock.name = 'Village dock and boats';
  dock.position.copy(shore);
  dock.rotation.y = -Math.atan2(tangentZ, tangentX);
  const wood = new THREE.MeshStandardMaterial({ color: '#714f35', roughness: 0.96 });
  const boards = new THREE.MeshStandardMaterial({ color: '#b3895c', roughness: 0.96 });
  const plank = new THREE.BoxGeometry(4.2, 0.21, 1.14);
  const post = new THREE.CylinderGeometry(0.17, 0.23, 2.4, 7);
  for (let i = 0; i < 20; i++) place(dock, plank, boards, 0, 0.85, 2 - i * 1.2);
  for (const x of [-1.9, 1.9]) {
    for (const z of [0, -7, -14, -21]) place(dock, post, wood, x, 0.2, z);
  }
  const hull = new THREE.SphereGeometry(1, 8, 4);
  const bench = new THREE.BoxGeometry(1.5, 0.18, 0.39);
  for (const [x, z, color] of [[4.2, -12, '#844239'], [-4.2, -19, '#55706b']]) {
    const boat = new THREE.Group();
    boat.position.set(x, 0.12, z);
    const shell = place(boat, hull, new THREE.MeshStandardMaterial({ color, flatShading: true }), 0, 0, 0);
    shell.scale.set(1.03, 0.46, 2.45);
    for (const seat of [-0.82, 0.18, 1.05]) place(boat, bench, boards, 0, 0.42, seat);
    dock.add(boat);
  }
  scene.add(dock);
}

function addLighthouse(scene, sample) {
  const westX = centerX - halfLength * tangentX;
  const westZ = centerZ - halfLength * tangentZ;
  let bestDistance = Infinity;
  let coastX = westX;
  let coastZ = westZ;
  for (let dz = -SCENERY.coastSearch; dz <= SCENERY.coastSearch; dz += SCENERY.coastStep) {
    for (let dx = -SCENERY.coastSearch; dx <= SCENERY.coastSearch; dx += SCENERY.coastStep) {
      const distance = Math.hypot(dx, dz);
      if (distance >= bestDistance) continue;
      const x = westX + dx;
      const z = westZ + dz;
      if (Math.abs(localRunwayX(x - centerX, z - centerZ)) < halfLength + SCENERY.coastRunwayBuffer
          && Math.abs(localRunwayZ(x - centerX, z - centerZ)) < halfWidth + SCENERY.coastRunwayBuffer) continue;
      const y = sample(x, z);
      if (y <= WORLD.seaLevel + 1 || y > WORLD.seaLevel + 5) continue;
      coastX = x;
      coastZ = z;
      bestDistance = distance;
    }
  }
  const lighthouse = new THREE.Group();
  lighthouse.name = 'West-end lighthouse';
  lighthouse.position.set(coastX, sample(coastX, coastZ) - 0.6, coastZ);
  const cream = new THREE.MeshStandardMaterial({ color: PALETTE.chalk });
  const red = new THREE.MeshStandardMaterial({ color: PALETTE.mailRed });
  const lamp = new THREE.MeshStandardMaterial({
    color: PALETTE.edgeLight, emissive: PALETTE.edgeLight, emissiveIntensity: 3,
  });
  for (let band = 0; band < 5; band++) {
    const radius = 4.1 - band * 0.28;
    place(lighthouse, new THREE.CylinderGeometry(radius - 0.28, radius, 4.4, 14),
      band % 2 ? red : cream, 0, 2.2 + band * 4.4, 0);
  }
  place(lighthouse, new THREE.CylinderGeometry(2.75, 2.75, 3.7, 14), lamp, 0, 23.85, 0);
  place(lighthouse, new THREE.ConeGeometry(3.6, 2.6, 14), red, 0, 27, 0);
  scene.add(lighthouse);
}

export function buildWorld(scene, seed = WORLD_SEED) {
  if (!heightGrid || gridSeed !== seed) {
    heightGrid = buildHeightGrid(seed);
    gridSeed = seed;
  }
  const grid = heightGrid;
  const sample = (x, z) => sampleGrid(grid, x, z);
  const normalMap = waterNormalMap();
  addSkyAndSea(scene, normalMap);
  addShallows(scene, sample, normalMap);
  addClouds(scene, createRandom(seed + 99));
  addTerrain(scene, grid, seed);
  addRunway(scene);
  addWaterLane(scene, seed);
  const stations = addStations(scene, sample);
  const village = addHouses(scene, sample, createRandom(seed + 78));
  addDock(scene, sample, village);
  const route = courseRingPositions(sample, seed);
  route.unshift(waterlaneCenter);
  route.push(waterlaneCenter);
  const plots = [...stations.children, ...village.children];
  function excludeScatter(x, z, runwayBuffer) {
    if (isNearRunway(x, z, runwayBuffer) || isOnWaterLane(x, z, 24)) return true;
    if (plots.some(({ position }) => Math.hypot(x - position.x, z - position.z) < 20)) return true;
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1];
      const b = route[i];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const t = THREE.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
      if (Math.hypot(x - a.x - t * dx, z - a.z - t * dz) < 26) return true;
    }
    return false;
  }
  addTrees(scene, sample, createRandom(seed), excludeScatter);
  addPalms(scene, sample, createRandom(seed + 79), excludeScatter);
  addRocks(scene, sample, createRandom(seed + 77), excludeScatter);
  addLighthouse(scene, sample);
  return { heightAt: sample, updateShadows: (position) => updateShadows(scene, position) };
}
