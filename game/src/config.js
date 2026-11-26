// Centralizes world, flight, course, and rendering settings.
export const STEP = 1 / 60;
export const TRAILS = { enabled: false };
export const WORLD_SEED = 302;
export const DEFAULT_SEED = WORLD_SEED;
export const BEST_KEY = 'duskmail-atoll.best';

export const WORLD = { size: 4096, grid: 256, seaLevel: 0, peakScale: 140, baseOffset: -6 };
export const RUNWAY = { nx: -0.55, nz: 0.45, length: 900, width: 60, elevation: 2, blend: 260 };
export const WATERLANE = { nx: -0.16, nz: 0.13, length: 620, width: 46, buoySpacing: 52, buoyBuffer: 14 };
export const TERRAIN = {
  frequency: 6, octaves: 5, lacunarity: 2, gain: 0.5, exponent: 1.3,
  innerStart: 0.35, innerEnd: 0.55, outerStart: 0.85, outerEnd: 1.05,
  foamEnd: 1.5, sandEnd: 4, grassHigh: 125, steepNormalY: 0.5, warmRockStart: 100, paleStart: 125,
};
export const AIRCRAFT = {
  minSpeed: 16, maxSpeed: 74, throttleRate: 0.45,
  pitchRate: 2.6, rollRate: 3.6, turnFactor: 0.62,
  autoLevelPitch: 1.5, autoLevelRoll: 2.0, maxPitch: 0.42, maxRoll: 0.88,
  initialThrottle: 0.56, speedResponse: 1.05, pitchSpeedFactor: 22,
  turnReferenceSpeed: 42, groundClearance: 1.1,
  landingSink: 4.5, landingSpeed: 33, landingRoll: 0.28,
  takeoffSpeed: 27, takeoffThrottle: 0.25, spawnInset: 22,
  waterSpeedResponse: 0.5,
  propellerIdle: 10, propellerPower: 42,
};
export const STALL = {
  aoaWarn: 12 * Math.PI / 180, aoaCrit: 15 * Math.PI / 180,
  fadeBand: 6 * Math.PI / 180, loadPenalty: 7 * Math.PI / 180, loadLimit: 2,
  liftResponse: 10, liftResponseStalled: 2.2, sinkRate: 9.5,
  bankSinkScale: 1.0,
  noseDropRate: 0.32, pitchAuthorityLoss: 0.55,
  liftSpeedLow: 31, liftSpeedFull: 38, liftAuthorityLow: 0.075,
  buffetVertical: 0.06, buffetLateral: 0.04, buffetRoll: 0.01,
  buffetVerticalRate: 41, buffetLateralRate: 33, buffetRollRate: 47,
};
export const COURSE = {
  ringCount: 10, ringRadius: 16, ringScore: 100, parTimeSeconds: 300,
  landingBonusPerSecond: 5, landingQualityMax: 500,
  seedOffset: 101, radialMin: 0.55, radialMax: 0.9, angleJitter: 0.15,
  clearanceMin: 35, clearanceMax: 110, ringTube: 2.0, ringHaloTube: 3.4, ringHaloOpacity: 0.15,
  landingIdealSpeed: 26, landingSpeedRange: 16, landingAlignment: Math.PI / 4,
};
export const PALETTE = {
  skyZenith: '#2e3d6e', skyMid: '#7a4a63', horizon: '#ff9e4a',
  sun: '#ffb36b', fog: '#f2a05e', sea: '#1d6a80', seaEmissive: '#07293a', sand: '#dcbd82',
  grassLow: '#69a24e', grassHigh: '#8fae56', rock: '#777c74', rockWarm: '#8d7f70', snow: '#f4efe6',
  ring: '#ff9e4a', ringNext: '#ffc46b', ringPassed: '#57e6a3',
  hudAmber: '#ffc46b', hudCyan: '#7fe7ff',
  asphalt: '#43484f', centerline: '#fffcf5', chalk: '#fff3d8', edgeLight: '#ffe5a5', windsock: '#ff782f',
  ambientSky: '#e1edff', ambientGround: '#9ca3a0', foam: '#f3e9c9', buoy: '#ff782f',
  cloud: '#ffe3c2', cloudShade: '#f0b98d',
  tree: '#315c42', treeSun: '#718745', house: '#ebc68e', roof: '#873e39',
  mailCream: '#f6e6c7', mailRed: '#bb3b35', metal: '#555766', canopy: '#233646',
  navPort: '#ff3546', navStarboard: '#55ff8c', navTail: '#ffffff',
};
export const SCENERY = {
  rockCount: 170, rockAttempts: 6000, rockMinHeight: -1.5, rockMaxHeight: 46, rockMinSlope: 0.5,
  houseCount: 5, cloudCount: 8,
  radius: 12000, fogNear: 1200, fogFar: 8500, sunElevation: 12, sunAzimuth: 238,
  sunlight: 1.6, ambient: 0.85, seaRoughness: 0.2,
  runwayLift: 0.15, dashSpacing: 24, dashLength: 12, dashWidth: 2, lightSpacing: 34,
  treeCount: 350, treeAttempts: 10000, treeMinHeight: 11, treeMaxHeight: 74, treeMaxSlope: 0.44,
  treeRunwayBuffer: 125, treeMinSize: 5, treeSizeRange: 11,
  coastSearch: 460, coastStep: 12, coastRunwayBuffer: 60,
};

export const VIEW = {
  maxFrame: 0.25, pixelRatio: 2, fov: 62, near: 0.5, far: 30000, exposure: 1.1,
  chaseBack: 15, chaseUp: 5.5, chaseLook: 40, chaseDamping: 5, chasePitch: 0.35, chaseBank: 0.35,
  orbitRadius: 1950, orbitHeight: 535, orbitRate: 0.048, shotFrames: 14,
};
export const HUD = {
  feetPerMetre: 3.281, knotsPerMetreSecond: 1.944, compassWidth: 290, tickDegrees: 15,
  panel: 'rgba(8, 12, 20, 0.55)', border: 'rgba(255, 196, 107, 0.45)',
  muted: '#d0dce0', ground: '#a56d46', sky: '#476c87', shade: 'rgba(8, 12, 20, 0.32)',
};
