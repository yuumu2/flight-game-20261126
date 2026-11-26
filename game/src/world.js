// Generates the shared elevation grid and builds the atoll scenery.
import * as THREE from 'three';
import { PALETTE, RUNWAY, SCENERY, TERRAIN, WORLD, WORLD_SEED } from './config.js';
import { createRandom, fbm, smoothstep } from './random.js';

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

function addSkyAndSea(scene) {
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
          vDirection = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 zenith, mid, horizon, sun, sunDirection;
        varying vec3 vDirection;
        void main() {
          vec3 direction = normalize(vDirection);
          float altitude = max(direction.y, 0.0);
          vec3 color = mix(horizon, mid, smoothstep(0.0, 0.42, altitude));
          color = mix(color, zenith, smoothstep(0.27, 1.0, altitude));
          float towardSun = max(dot(direction, sunDirection), 0.0);
          color = mix(color, sun, 0.60 * pow(towardSun, 10.0));
          color += sun * (0.25 * pow(towardSun, 110.0)
            + 1.5 * smoothstep(0.99970, 0.99985, towardSun));
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
  scene.add(sun, new THREE.HemisphereLight(PALETTE.ambientSky, PALETTE.ambientGround, SCENERY.ambient));

  const sea = new THREE.Mesh(
    new THREE.CircleGeometry(SCENERY.radius, 128),
    new THREE.MeshStandardMaterial({
      color: PALETTE.sea, emissive: PALETTE.seaEmissive, roughness: SCENERY.seaRoughness,
    }),
  );
  sea.name = 'Lagoon and open sea';
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = WORLD.seaLevel;
  scene.add(sea);
}

function slopeAt(sample, x, z) {
  return Math.hypot(
    sample(x + spacing, z) - sample(x - spacing, z),
    sample(x, z + spacing) - sample(x, z - spacing),
  ) / (2 * spacing);
}

function addTerrain(scene, grid) {
  const geometry = new THREE.PlaneGeometry(WORLD.size, WORLD.size, last, last);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  const lowGrass = new THREE.Color(PALETTE.grassLow);
  const highGrass = new THREE.Color(PALETTE.grassHigh);
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const y = grid[i];
    positions.setY(i, y);
    color.copy(lowGrass).lerp(highGrass, smoothstep(TERRAIN.sandEnd, TERRAIN.grassHigh, y));
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.biomeSand = { value: new THREE.Color(PALETTE.sand) };
    shader.uniforms.biomeRock = { value: new THREE.Color(PALETTE.rock) };
    shader.uniforms.biomeWarmRock = { value: new THREE.Color(PALETTE.rockWarm) };
    shader.uniforms.biomePale = { value: new THREE.Color(PALETTE.snow) };
    shader.vertexShader = `
      varying float vTerrainElevation;
      ${shader.vertexShader}
    `.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vTerrainElevation = position.y;
    `);
    // Use the flat-shaded face normal in world space so rock boundaries never bleed onto grassy slopes.
    shader.fragmentShader = `
      varying float vTerrainElevation;
      uniform vec3 biomeSand, biomeRock, biomeWarmRock, biomePale;
      ${shader.fragmentShader}
    `.replace('#include <normal_fragment_begin>', `
      #include <normal_fragment_begin>
      float upNormal = inverseTransformDirection(normal, viewMatrix).y;
      if (vTerrainElevation > ${TERRAIN.paleStart.toFixed(1)}) {
        diffuseColor.rgb = biomePale;
      } else if (vTerrainElevation <= ${TERRAIN.sandEnd.toFixed(1)}) {
        diffuseColor.rgb = biomeSand;
      } else if (upNormal < ${TERRAIN.steepNormalY}) {
        diffuseColor.rgb = vTerrainElevation > ${TERRAIN.warmRockStart.toFixed(1)} ? biomeWarmRock : biomeRock;
      }
    `);
  };
  const terrain = new THREE.Mesh(geometry, material);
  terrain.name = 'Atoll terrain';
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

function addTrees(scene, sample, random) {
  const trees = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1, 1, 6),
    new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 }),
    SCENERY.treeCount,
  );
  trees.name = 'Atoll trees';
  const tree = new THREE.Object3D();
  const shade = new THREE.Color(PALETTE.tree);
  const sun = new THREE.Color(PALETTE.treeSun);
  const color = new THREE.Color();
  let count = 0;
  for (let attempt = 0; attempt < SCENERY.treeAttempts && count < SCENERY.treeCount; attempt++) {
    const x = (random() - 0.5) * WORLD.size;
    const z = (random() - 0.5) * WORLD.size;
    const y = sample(x, z);
    const dx = x - centerX;
    const dz = z - centerZ;
    if (y < SCENERY.treeMinHeight || y > SCENERY.treeMaxHeight || slopeAt(sample, x, z) > SCENERY.treeMaxSlope) continue;
    if (Math.abs(localRunwayX(dx, dz)) < halfLength + SCENERY.treeRunwayBuffer
        && Math.abs(localRunwayZ(dx, dz)) < halfWidth + SCENERY.treeRunwayBuffer) continue;
    const size = SCENERY.treeMinSize + random() * SCENERY.treeSizeRange;
    tree.position.set(x, y + size * 0.43, z);
    tree.scale.set(size * 0.33, size, size * 0.33);
    tree.rotation.y = random() * Math.PI * 2;
    tree.updateMatrix();
    trees.setMatrixAt(count, tree.matrix);
    trees.setColorAt(count, color.copy(shade).lerp(sun, random()));
    count++;
  }
  trees.count = count;
  scene.add(trees);
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
  addSkyAndSea(scene);
  addTerrain(scene, grid);
  addRunway(scene);
  addTrees(scene, sample, createRandom(seed));
  addStations(scene, sample);
  addLighthouse(scene, sample);
  return { heightAt: sample };
}
