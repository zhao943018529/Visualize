var deg2radian = Math.PI / 180;
var radian2deg = 180 / Math.PI;

export function deg2radians(deg) {
  return deg2radian * deg;
}

export function radians2deg(radians) {
  return radian2deg * radians;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

export function rand(min, max) {
  return Math.random() * (max - min) + min;
}
