// Physical data of the Sun and the bodies, scale math and geodesy helpers
// for the outdoor Solar System scale model.

export const SUN = {
  id: 'sun',
  name: 'Slunce',
  diameterKm: 1392700,
  color: '#f5b400',
};

// Distance = semi-major axis, size = equatorial diameter.
export const BODIES = [
  { id: 'mercury', name: 'Merkur',  semiMajorAxisKm: 57909050,   diameterKm: 4879.4,  color: '#9a8f86', enabledByDefault: true },
  { id: 'venus',   name: 'Venuše',  semiMajorAxisKm: 108208000,  diameterKm: 12103.6, color: '#d9a441', enabledByDefault: true },
  { id: 'earth',   name: 'Země',    semiMajorAxisKm: 149598023,  diameterKm: 12756.3, color: '#2f7fd8', enabledByDefault: true },
  { id: 'mars',    name: 'Mars',    semiMajorAxisKm: 227939200,  diameterKm: 6792.4,  color: '#c8492c', enabledByDefault: true },
  { id: 'ceres',   name: 'Ceres',   semiMajorAxisKm: 413690000,  diameterKm: 939.4,   color: '#7d7d7d', enabledByDefault: false },
  { id: 'jupiter', name: 'Jupiter', semiMajorAxisKm: 778570000,  diameterKm: 142984,  color: '#b5713a', enabledByDefault: true },
  { id: 'saturn',  name: 'Saturn',  semiMajorAxisKm: 1433530000, diameterKm: 120536,  color: '#b89b4b', enabledByDefault: true },
  { id: 'uranus',  name: 'Uran',    semiMajorAxisKm: 2872460000, diameterKm: 51118,   color: '#3aa6b0', enabledByDefault: true },
  { id: 'neptune', name: 'Neptun',  semiMajorAxisKm: 4495060000, diameterKm: 49528,   color: '#3a5fcd', enabledByDefault: true },
  { id: 'pluto',   name: 'Pluto',   semiMajorAxisKm: 5906380000, diameterKm: 2376.6,  color: '#8b6f9e', enabledByDefault: true },
];

export const DEFAULT_SUN = { lat: 49.9351772, lon: 15.7629392 };
export const DEFAULT_ZOOM = 14;
export const DEFAULT_SCALE = 1000000000;
export const SCALE_PRESETS = [500000000, 1000000000, 1500000000, 2000000000];

export function modelDistanceM(body, scale) {
  return (body.semiMajorAxisKm * 1000) / scale;
}

export function modelDiameterM(body, scale) {
  return (body.diameterKm * 1000) / scale;
}

// Scale denominator for a Sun model of the given diameter, rounded to a whole number
// so that e.g. 1.3927 m maps exactly onto the 1 : 1 000 000 000 preset.
export function scaleForSunDiameter(diameterM) {
  return Math.round((SUN.diameterKm * 1000) / diameterM);
}

// WGS84 ellipsoid
const WGS84_A = 6378137;
const WGS84_F = 1 / 298.257223563;
const WGS84_B = WGS84_A * (1 - WGS84_F);

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

// Vincenty direct problem: point reached from (lat, lon) along the initial
// bearing (degrees) after distance (metres) on the WGS84 ellipsoid.
// Returns [lon, lat] for GeoJSON.
export function vincentyDirect(lat, lon, bearing, distance) {
  const alpha1 = toRad(bearing);
  const sinAlpha1 = Math.sin(alpha1);
  const cosAlpha1 = Math.cos(alpha1);

  const tanU1 = (1 - WGS84_F) * Math.tan(toRad(lat));
  const cosU1 = 1 / Math.sqrt(1 + tanU1 * tanU1);
  const sinU1 = tanU1 * cosU1;
  const sigma1 = Math.atan2(tanU1, cosAlpha1);
  const sinAlpha = cosU1 * sinAlpha1;
  const cosSqAlpha = 1 - sinAlpha * sinAlpha;
  const uSq = (cosSqAlpha * (WGS84_A * WGS84_A - WGS84_B * WGS84_B)) / (WGS84_B * WGS84_B);
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));

  let sigma = distance / (WGS84_B * A);
  let sigmaPrev;
  let cos2SigmaM;
  let sinSigma;
  let cosSigma;
  let iterations = 0;
  do {
    cos2SigmaM = Math.cos(2 * sigma1 + sigma);
    sinSigma = Math.sin(sigma);
    cosSigma = Math.cos(sigma);
    const deltaSigma =
      B * sinSigma * (cos2SigmaM + (B / 4) * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
        (B / 6) * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));
    sigmaPrev = sigma;
    sigma = distance / (WGS84_B * A) + deltaSigma;
  } while (Math.abs(sigma - sigmaPrev) > 1e-12 && ++iterations < 100);

  const tmp = sinU1 * sinSigma - cosU1 * cosSigma * cosAlpha1;
  const lat2 = Math.atan2(
    sinU1 * cosSigma + cosU1 * sinSigma * cosAlpha1,
    (1 - WGS84_F) * Math.sqrt(sinAlpha * sinAlpha + tmp * tmp),
  );
  const lambda = Math.atan2(sinSigma * sinAlpha1, cosU1 * cosSigma - sinU1 * sinSigma * cosAlpha1);
  const C = (WGS84_F / 16) * cosSqAlpha * (4 + WGS84_F * (4 - 3 * cosSqAlpha));
  const L = lambda - (1 - C) * WGS84_F * sinAlpha *
    (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));

  return [lon + toDeg(L), toDeg(lat2)];
}

// Closed ring of points at constant geodesic distance from the centre.
export function geodesicCircle(center, radiusM, steps = 256) {
  const ring = [];
  for (let i = 0; i < steps; i++) {
    ring.push(vincentyDirect(center.lat, center.lon, (360 * i) / steps, radiusM));
  }
  ring.push(ring[0]);
  return ring;
}

// --- Czech number formatting for the UI ---

const NBSP = ' ';

function formatNumber(value, fractionDigits) {
  return value
    .toLocaleString('cs-CZ', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })
    .replace(/\s/g, NBSP);
}

export function formatDistance(meters) {
  if (meters >= 1000) return `${formatNumber(meters / 1000, 2)}${NBSP}km`;
  if (meters >= 10) return `${formatNumber(meters, 0)}${NBSP}m`;
  return `${formatNumber(meters, 1)}${NBSP}m`;
}

export function formatSize(meters) {
  if (meters >= 1) return `${formatNumber(meters, 2)}${NBSP}m`;
  if (meters >= 0.01) return `${formatNumber(meters * 100, 1)}${NBSP}cm`;
  return `${formatNumber(meters * 1000, 1)}${NBSP}mm`;
}

export function formatScale(scale) {
  return `1${NBSP}:${NBSP}${formatNumber(Math.round(scale), 0)}`;
}

// Accepts "900 000 000", "900000000", "9e8", "900,5".
export function parseNumber(text) {
  const cleaned = String(text).replace(/[\s ]/g, '').replace(',', '.');
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}
