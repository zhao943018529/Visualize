import React, { useRef, useEffect } from "react";
import * as twgl from "twgl.js";
import {
  matIV,
  qtnIV,
  torus,
  sphere,
  cube,
  hsva,
} from "../../utils/minMatrixb";
import { deg2radians } from "../../utils/math";
const { m4 } = twgl;

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 1024;

const skinVS = `#version 300 es
in vec4 a_POSITION;
in vec3 a_NORMAL;
in vec4 a_WEIGHTS_0;
in uvec4 a_JOINTS_0;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_world;
uniform sampler2D u_jointTexture;

out vec3 v_normal;

mat4 getBoneMatrix(uint jointNdx) {
  return mat4(
    texelFetch(u_jointTexture, ivec2(0, jointNdx), 0),
    texelFetch(u_jointTexture, ivec2(1, jointNdx), 0),
    texelFetch(u_jointTexture, ivec2(2, jointNdx), 0),
    texelFetch(u_jointTexture, ivec2(3, jointNdx), 0));
}

void main() {
  mat4 skinMatrix = getBoneMatrix(a_JOINTS_0[0]) * a_WEIGHTS_0[0] +
                    getBoneMatrix(a_JOINTS_0[1]) * a_WEIGHTS_0[1] +
                    getBoneMatrix(a_JOINTS_0[2]) * a_WEIGHTS_0[2] +
                    getBoneMatrix(a_JOINTS_0[3]) * a_WEIGHTS_0[3];
  mat4 world = u_world * skinMatrix;
  gl_Position = u_projection * u_view * world * a_POSITION;
  v_normal = mat3(world) * a_NORMAL;

  // for debugging .. see article
  //gl_Position = u_projection * u_view *  a_POSITION;
  //v_normal = a_NORMAL;
  //v_normal = a_WEIGHTS_0.xyz * 2. - 1.;
  //v_normal = vec3(a_JOINTS_0.xyz) / float(textureSize(u_jointTexture, 0).y - 1) * 2. - 1.;
}
`;
const fs = `#version 300 es
precision highp float;

in vec3 v_normal;

uniform vec4 u_diffuse;
uniform vec3 u_lightDirection;

out vec4 outColor;

void main () {
  vec3 normal = normalize(v_normal);
  float light = dot(u_lightDirection, normal) * .5 + .5;
  outColor = vec4(u_diffuse.rgb * light, u_diffuse.a);

  // for debugging .. see article
//   outColor = vec4(1, 0, 0, 1);
  //outColor = vec4(v_normal * .5 + .5, 1);
}
`;

function length(v: number[]) {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function normalize(v: number[] | Float32Array, dst?: any) {
  dst = dst || new Float32Array(3);
  var length = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  // make sure we don't divide by 0.
  if (length > 0.00001) {
    dst[0] = v[0] / length;
    dst[1] = v[1] / length;
    dst[2] = v[2] / length;
  }
  return dst;
}

function multiply(a: any, b: any, dst: any) {
  dst = dst || new Float32Array(16);
  var b00 = b[0 * 4 + 0];
  var b01 = b[0 * 4 + 1];
  var b02 = b[0 * 4 + 2];
  var b03 = b[0 * 4 + 3];
  var b10 = b[1 * 4 + 0];
  var b11 = b[1 * 4 + 1];
  var b12 = b[1 * 4 + 2];
  var b13 = b[1 * 4 + 3];
  var b20 = b[2 * 4 + 0];
  var b21 = b[2 * 4 + 1];
  var b22 = b[2 * 4 + 2];
  var b23 = b[2 * 4 + 3];
  var b30 = b[3 * 4 + 0];
  var b31 = b[3 * 4 + 1];
  var b32 = b[3 * 4 + 2];
  var b33 = b[3 * 4 + 3];
  var a00 = a[0 * 4 + 0];
  var a01 = a[0 * 4 + 1];
  var a02 = a[0 * 4 + 2];
  var a03 = a[0 * 4 + 3];
  var a10 = a[1 * 4 + 0];
  var a11 = a[1 * 4 + 1];
  var a12 = a[1 * 4 + 2];
  var a13 = a[1 * 4 + 3];
  var a20 = a[2 * 4 + 0];
  var a21 = a[2 * 4 + 1];
  var a22 = a[2 * 4 + 2];
  var a23 = a[2 * 4 + 3];
  var a30 = a[3 * 4 + 0];
  var a31 = a[3 * 4 + 1];
  var a32 = a[3 * 4 + 2];
  var a33 = a[3 * 4 + 3];
  dst[0] = b00 * a00 + b01 * a10 + b02 * a20 + b03 * a30;
  dst[1] = b00 * a01 + b01 * a11 + b02 * a21 + b03 * a31;
  dst[2] = b00 * a02 + b01 * a12 + b02 * a22 + b03 * a32;
  dst[3] = b00 * a03 + b01 * a13 + b02 * a23 + b03 * a33;
  dst[4] = b10 * a00 + b11 * a10 + b12 * a20 + b13 * a30;
  dst[5] = b10 * a01 + b11 * a11 + b12 * a21 + b13 * a31;
  dst[6] = b10 * a02 + b11 * a12 + b12 * a22 + b13 * a32;
  dst[7] = b10 * a03 + b11 * a13 + b12 * a23 + b13 * a33;
  dst[8] = b20 * a00 + b21 * a10 + b22 * a20 + b23 * a30;
  dst[9] = b20 * a01 + b21 * a11 + b22 * a21 + b23 * a31;
  dst[10] = b20 * a02 + b21 * a12 + b22 * a22 + b23 * a32;
  dst[11] = b20 * a03 + b21 * a13 + b22 * a23 + b23 * a33;
  dst[12] = b30 * a00 + b31 * a10 + b32 * a20 + b33 * a30;
  dst[13] = b30 * a01 + b31 * a11 + b32 * a21 + b33 * a31;
  dst[14] = b30 * a02 + b31 * a12 + b32 * a22 + b33 * a32;
  dst[15] = b30 * a03 + b31 * a13 + b32 * a23 + b33 * a33;
  return dst;
}

function copy(src: any, dst?: any) {
  dst = dst || new Float32Array(16);

  dst[0] = src[0];
  dst[1] = src[1];
  dst[2] = src[2];
  dst[3] = src[3];
  dst[4] = src[4];
  dst[5] = src[5];
  dst[6] = src[6];
  dst[7] = src[7];
  dst[8] = src[8];
  dst[9] = src[9];
  dst[10] = src[10];
  dst[11] = src[11];
  dst[12] = src[12];
  dst[13] = src[13];
  dst[14] = src[14];
  dst[15] = src[15];

  return dst;
}

function inverse(m: any, dst?: Float32Array) {
  dst = dst || new Float32Array(16);
  var m00 = m[0 * 4 + 0];
  var m01 = m[0 * 4 + 1];
  var m02 = m[0 * 4 + 2];
  var m03 = m[0 * 4 + 3];
  var m10 = m[1 * 4 + 0];
  var m11 = m[1 * 4 + 1];
  var m12 = m[1 * 4 + 2];
  var m13 = m[1 * 4 + 3];
  var m20 = m[2 * 4 + 0];
  var m21 = m[2 * 4 + 1];
  var m22 = m[2 * 4 + 2];
  var m23 = m[2 * 4 + 3];
  var m30 = m[3 * 4 + 0];
  var m31 = m[3 * 4 + 1];
  var m32 = m[3 * 4 + 2];
  var m33 = m[3 * 4 + 3];
  var tmp_0 = m22 * m33;
  var tmp_1 = m32 * m23;
  var tmp_2 = m12 * m33;
  var tmp_3 = m32 * m13;
  var tmp_4 = m12 * m23;
  var tmp_5 = m22 * m13;
  var tmp_6 = m02 * m33;
  var tmp_7 = m32 * m03;
  var tmp_8 = m02 * m23;
  var tmp_9 = m22 * m03;
  var tmp_10 = m02 * m13;
  var tmp_11 = m12 * m03;
  var tmp_12 = m20 * m31;
  var tmp_13 = m30 * m21;
  var tmp_14 = m10 * m31;
  var tmp_15 = m30 * m11;
  var tmp_16 = m10 * m21;
  var tmp_17 = m20 * m11;
  var tmp_18 = m00 * m31;
  var tmp_19 = m30 * m01;
  var tmp_20 = m00 * m21;
  var tmp_21 = m20 * m01;
  var tmp_22 = m00 * m11;
  var tmp_23 = m10 * m01;

  var t0 =
    tmp_0 * m11 +
    tmp_3 * m21 +
    tmp_4 * m31 -
    (tmp_1 * m11 + tmp_2 * m21 + tmp_5 * m31);
  var t1 =
    tmp_1 * m01 +
    tmp_6 * m21 +
    tmp_9 * m31 -
    (tmp_0 * m01 + tmp_7 * m21 + tmp_8 * m31);
  var t2 =
    tmp_2 * m01 +
    tmp_7 * m11 +
    tmp_10 * m31 -
    (tmp_3 * m01 + tmp_6 * m11 + tmp_11 * m31);
  var t3 =
    tmp_5 * m01 +
    tmp_8 * m11 +
    tmp_11 * m21 -
    (tmp_4 * m01 + tmp_9 * m11 + tmp_10 * m21);

  var d = 1.0 / (m00 * t0 + m10 * t1 + m20 * t2 + m30 * t3);

  dst[0] = d * t0;
  dst[1] = d * t1;
  dst[2] = d * t2;
  dst[3] = d * t3;
  dst[4] =
    d *
    (tmp_1 * m10 +
      tmp_2 * m20 +
      tmp_5 * m30 -
      (tmp_0 * m10 + tmp_3 * m20 + tmp_4 * m30));
  dst[5] =
    d *
    (tmp_0 * m00 +
      tmp_7 * m20 +
      tmp_8 * m30 -
      (tmp_1 * m00 + tmp_6 * m20 + tmp_9 * m30));
  dst[6] =
    d *
    (tmp_3 * m00 +
      tmp_6 * m10 +
      tmp_11 * m30 -
      (tmp_2 * m00 + tmp_7 * m10 + tmp_10 * m30));
  dst[7] =
    d *
    (tmp_4 * m00 +
      tmp_9 * m10 +
      tmp_10 * m20 -
      (tmp_5 * m00 + tmp_8 * m10 + tmp_11 * m20));
  dst[8] =
    d *
    (tmp_12 * m13 +
      tmp_15 * m23 +
      tmp_16 * m33 -
      (tmp_13 * m13 + tmp_14 * m23 + tmp_17 * m33));
  dst[9] =
    d *
    (tmp_13 * m03 +
      tmp_18 * m23 +
      tmp_21 * m33 -
      (tmp_12 * m03 + tmp_19 * m23 + tmp_20 * m33));
  dst[10] =
    d *
    (tmp_14 * m03 +
      tmp_19 * m13 +
      tmp_22 * m33 -
      (tmp_15 * m03 + tmp_18 * m13 + tmp_23 * m33));
  dst[11] =
    d *
    (tmp_17 * m03 +
      tmp_20 * m13 +
      tmp_23 * m23 -
      (tmp_16 * m03 + tmp_21 * m13 + tmp_22 * m23));
  dst[12] =
    d *
    (tmp_14 * m22 +
      tmp_17 * m32 +
      tmp_13 * m12 -
      (tmp_16 * m32 + tmp_12 * m12 + tmp_15 * m22));
  dst[13] =
    d *
    (tmp_20 * m32 +
      tmp_12 * m02 +
      tmp_19 * m22 -
      (tmp_18 * m22 + tmp_21 * m32 + tmp_13 * m02));
  dst[14] =
    d *
    (tmp_18 * m12 +
      tmp_23 * m32 +
      tmp_15 * m02 -
      (tmp_22 * m32 + tmp_14 * m02 + tmp_19 * m12));
  dst[15] =
    d *
    (tmp_22 * m22 +
      tmp_16 * m02 +
      tmp_21 * m12 -
      (tmp_20 * m12 + tmp_23 * m22 + tmp_17 * m02));

  return dst;
}

function subtractVectors(a: number[], b: number[], dst?: Float32Array) {
  dst = dst || new Float32Array(3);
  dst[0] = a[0] - b[0];
  dst[1] = a[1] - b[1];
  dst[2] = a[2] - b[2];
  return dst;
}

function cross(a: number[], b: number[], dst?: Float32Array) {
  dst = dst || new Float32Array(3);
  dst[0] = a[1] * b[2] - a[2] * b[1];
  dst[1] = a[2] * b[0] - a[0] * b[2];
  dst[2] = a[0] * b[1] - a[1] * b[0];
  return dst;
}

function lookAt(
  cameraPosition: number[],
  target: number[],
  up: number[],
  dst?: Float32Array
) {
  dst = dst || new Float32Array(16);
  var zAxis = normalize(subtractVectors(cameraPosition, target));
  var xAxis = normalize(cross(up, zAxis));
  var yAxis = normalize(cross(zAxis, xAxis));

  dst[0] = xAxis[0];
  dst[1] = xAxis[1];
  dst[2] = xAxis[2];
  dst[3] = 0;
  dst[4] = yAxis[0];
  dst[5] = yAxis[1];
  dst[6] = yAxis[2];
  dst[7] = 0;
  dst[8] = zAxis[0];
  dst[9] = zAxis[1];
  dst[10] = zAxis[2];
  dst[11] = 0;
  dst[12] = cameraPosition[0];
  dst[13] = cameraPosition[1];
  dst[14] = cameraPosition[2];
  dst[15] = 1;

  return dst;
}

function perspective(
  fieldOfViewInRadians: number,
  aspect: number,
  near: number,
  far: number,
  dst?: Float32Array
) {
  dst = dst || new Float32Array(16);
  var f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfViewInRadians);
  var rangeInv = 1.0 / (near - far);

  dst[0] = f / aspect;
  dst[1] = 0;
  dst[2] = 0;
  dst[3] = 0;
  dst[4] = 0;
  dst[5] = f;
  dst[6] = 0;
  dst[7] = 0;
  dst[8] = 0;
  dst[9] = 0;
  dst[10] = (near + far) * rangeInv;
  dst[11] = -1;
  dst[12] = 0;
  dst[13] = 0;
  dst[14] = near * far * rangeInv * 2;
  dst[15] = 0;

  return dst;
}

function xRotate(m: any, angleInRadians: number, dst?: any) {
  // this is the optimized version of
  // return multiply(m, xRotation(angleInRadians), dst);
  dst = dst || new Float32Array(16);

  var m10 = m[4];
  var m11 = m[5];
  var m12 = m[6];
  var m13 = m[7];
  var m20 = m[8];
  var m21 = m[9];
  var m22 = m[10];
  var m23 = m[11];
  var c = Math.cos(angleInRadians);
  var s = Math.sin(angleInRadians);

  dst[4] = c * m10 + s * m20;
  dst[5] = c * m11 + s * m21;
  dst[6] = c * m12 + s * m22;
  dst[7] = c * m13 + s * m23;
  dst[8] = c * m20 - s * m10;
  dst[9] = c * m21 - s * m11;
  dst[10] = c * m22 - s * m12;
  dst[11] = c * m23 - s * m13;

  if (m !== dst) {
    dst[0] = m[0];
    dst[1] = m[1];
    dst[2] = m[2];
    dst[3] = m[3];
    dst[12] = m[12];
    dst[13] = m[13];
    dst[14] = m[14];
    dst[15] = m[15];
  }

  return dst;
}

function compose(
  translation: number[],
  quaternion: number[],
  scale: number[],
  dst: any
) {
  dst = dst || new Float32Array(16);

  const x = quaternion[0];
  const y = quaternion[1];
  const z = quaternion[2];
  const w = quaternion[3];

  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;

  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;

  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;

  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;

  const sx = scale[0];
  const sy = scale[1];
  const sz = scale[2];

  dst[0] = (1 - (yy + zz)) * sx;
  dst[1] = (xy + wz) * sx;
  dst[2] = (xz - wy) * sx;
  dst[3] = 0;

  dst[4] = (xy - wz) * sy;
  dst[5] = (1 - (xx + zz)) * sy;
  dst[6] = (yz + wx) * sy;
  dst[7] = 0;

  dst[8] = (xz + wy) * sz;
  dst[9] = (yz - wx) * sz;
  dst[10] = (1 - (xx + yy)) * sz;
  dst[11] = 0;

  dst[12] = translation[0];
  dst[13] = translation[1];
  dst[14] = translation[2];
  dst[15] = 1;

  return dst;
}

function quatFromRotationMatrix(m: any, dst: any) {
  // http://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/index.htm

  // assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)
  const m11 = m[0];
  const m12 = m[4];
  const m13 = m[8];
  const m21 = m[1];
  const m22 = m[5];
  const m23 = m[9];
  const m31 = m[2];
  const m32 = m[6];
  const m33 = m[10];

  const trace = m11 + m22 + m33;

  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    dst[3] = 0.25 / s;
    dst[0] = (m32 - m23) * s;
    dst[1] = (m13 - m31) * s;
    dst[2] = (m21 - m12) * s;
  } else if (m11 > m22 && m11 > m33) {
    const s = 2 * Math.sqrt(1 + m11 - m22 - m33);
    dst[3] = (m32 - m23) / s;
    dst[0] = 0.25 * s;
    dst[1] = (m12 + m21) / s;
    dst[2] = (m13 + m31) / s;
  } else if (m22 > m33) {
    const s = 2 * Math.sqrt(1 + m22 - m11 - m33);
    dst[3] = (m13 - m31) / s;
    dst[0] = (m12 + m21) / s;
    dst[1] = 0.25 * s;
    dst[2] = (m23 + m32) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
    dst[3] = (m21 - m12) / s;
    dst[0] = (m13 + m31) / s;
    dst[1] = (m23 + m32) / s;
    dst[2] = 0.25 * s;
  }
}

function determinate(m: any) {
  var m00 = m[0 * 4 + 0];
  var m01 = m[0 * 4 + 1];
  var m02 = m[0 * 4 + 2];
  var m03 = m[0 * 4 + 3];
  var m10 = m[1 * 4 + 0];
  var m11 = m[1 * 4 + 1];
  var m12 = m[1 * 4 + 2];
  var m13 = m[1 * 4 + 3];
  var m20 = m[2 * 4 + 0];
  var m21 = m[2 * 4 + 1];
  var m22 = m[2 * 4 + 2];
  var m23 = m[2 * 4 + 3];
  var m30 = m[3 * 4 + 0];
  var m31 = m[3 * 4 + 1];
  var m32 = m[3 * 4 + 2];
  var m33 = m[3 * 4 + 3];
  var tmp_0 = m22 * m33;
  var tmp_1 = m32 * m23;
  var tmp_2 = m12 * m33;
  var tmp_3 = m32 * m13;
  var tmp_4 = m12 * m23;
  var tmp_5 = m22 * m13;
  var tmp_6 = m02 * m33;
  var tmp_7 = m32 * m03;
  var tmp_8 = m02 * m23;
  var tmp_9 = m22 * m03;
  var tmp_10 = m02 * m13;
  var tmp_11 = m12 * m03;

  var t0 =
    tmp_0 * m11 +
    tmp_3 * m21 +
    tmp_4 * m31 -
    (tmp_1 * m11 + tmp_2 * m21 + tmp_5 * m31);
  var t1 =
    tmp_1 * m01 +
    tmp_6 * m21 +
    tmp_9 * m31 -
    (tmp_0 * m01 + tmp_7 * m21 + tmp_8 * m31);
  var t2 =
    tmp_2 * m01 +
    tmp_7 * m11 +
    tmp_10 * m31 -
    (tmp_3 * m01 + tmp_6 * m11 + tmp_11 * m31);
  var t3 =
    tmp_5 * m01 +
    tmp_8 * m11 +
    tmp_11 * m21 -
    (tmp_4 * m01 + tmp_9 * m11 + tmp_10 * m21);

  return 1.0 / (m00 * t0 + m10 * t1 + m20 * t2 + m30 * t3);
}

function decompose(
  mat: any,
  translation: number[],
  quaternion: number[],
  scale: number[]
) {
  let sx = length(mat.slice(0, 3));
  const sy = length(mat.slice(4, 7));
  const sz = length(mat.slice(8, 11));

  // if determinate is negative, we need to invert one scale
  const det = determinate(mat);
  if (det < 0) {
    sx = -sx;
  }

  translation[0] = mat[12];
  translation[1] = mat[13];
  translation[2] = mat[14];

  // scale the rotation part
  const matrix = copy(mat);

  const invSX = 1 / sx;
  const invSY = 1 / sy;
  const invSZ = 1 / sz;

  matrix[0] *= invSX;
  matrix[1] *= invSX;
  matrix[2] *= invSX;

  matrix[4] *= invSY;
  matrix[5] *= invSY;
  matrix[6] *= invSY;

  matrix[8] *= invSZ;
  matrix[9] *= invSZ;
  matrix[10] *= invSZ;

  quatFromRotationMatrix(matrix, quaternion);

  scale[0] = sx;
  scale[1] = sy;
  scale[2] = sz;
}

type OptionsFlags<glTypeToTypedArrayMap> = {
  [Property in keyof glTypeToTypedArrayMap]: boolean;
};

const programOptions = {
  attribLocations: {
    a_POSITION: 0,
    a_NORMAL: 1,
    a_WEIGHTS_0: 2,
    a_JOINTS_0: 3,
  },
};

export default function Skin() {
  const cavRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getContext(cavElem) as WebGL2RenderingContext;
    const skinProgramInfo = twgl.createProgramInfo(
      gl,
      [skinVS, fs],
      programOptions
    );

    const m = new matIV();
    const globalMatrix = m.identity(m.create());
    const mMatrix = m.identity(m.create());
    const q = new qtnIV();
    const qtn = q.identity(q.create());

    class Skin {
      joints: any[];
      inverseBindMatrices: Float32Array[];
      jointMatrices: any[];
      jointData: Float32Array;
      jointTexture: WebGLTexture;

      constructor(joints: any[], inverseBindMatrixData: Float32Array) {
        this.joints = joints;
        this.inverseBindMatrices = [];
        this.jointMatrices = [];
        // allocate enough space for one matrix per joint
        this.jointData = new Float32Array(joints.length * 16);
        // create views for each joint and inverseBindMatrix
        for (let i = 0; i < joints.length; ++i) {
          this.inverseBindMatrices.push(
            new Float32Array(
              inverseBindMatrixData.buffer,
              inverseBindMatrixData.byteOffset +
                Float32Array.BYTES_PER_ELEMENT * 16 * i,
              16
            )
          );
          this.jointMatrices.push(
            new Float32Array(
              this.jointData.buffer,
              Float32Array.BYTES_PER_ELEMENT * 16 * i,
              16
            )
          );
        }
        // create a texture to hold the joint matrices
        this.jointTexture = gl.createTexture() as WebGLTexture;
        gl.bindTexture(gl.TEXTURE_2D, this.jointTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
      update(node: Node) {
        const globalWorldInverse = inverse(node.worldMatrix);
        // go through each joint and get its current worldMatrix
        // apply the inverse bind matrices and store the
        // entire result in the texture
        for (let j = 0; j < this.joints.length; ++j) {
          const joint = this.joints[j];
          const dst = this.jointMatrices[j];
          multiply(globalWorldInverse, joint.worldMatrix, dst);
          multiply(dst, this.inverseBindMatrices[j], dst);
        }
        gl.bindTexture(gl.TEXTURE_2D, this.jointTexture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA32F,
          4,
          this.joints.length,
          0,
          gl.RGBA,
          gl.FLOAT,
          this.jointData
        );
      }
    }

    class TRS {
      position: number[];
      rotation: number[];
      scale: number[];

      constructor(
        position = [0, 0, 0],
        rotation = [0, 0, 0, 1],
        scale = [1, 1, 1]
      ) {
        this.position = position;
        this.rotation = rotation;
        this.scale = scale;
      }
      getMatrix(dst: any) {
        dst = dst || new Float32Array(16);
        compose(this.position, this.rotation, this.scale, dst);
        return dst;
      }
    }

    class Node {
      name: string;
      source: TRS;
      parent: Node | null;
      children: Node[];
      localMatrix: any;
      worldMatrix: any;
      drawables: any[];

      constructor(source: TRS, name: string) {
        this.name = name;
        this.source = source;
        this.parent = null;
        this.children = [];
        this.localMatrix = m4.identity();
        this.worldMatrix = m4.identity();
        this.drawables = [];
      }
      setParent(parent: Node) {
        if (this.parent) {
          this.parent._removeChild(this);
          this.parent = null;
        }
        if (parent) {
          parent._addChild(this);
          this.parent = parent;
        }
      }
      updateWorldMatrix(parentWorldMatrix: any) {
        const source = this.source;
        if (source) {
          source.getMatrix(this.localMatrix);
        }

        if (parentWorldMatrix) {
          // a matrix was passed in so do the math
          multiply(parentWorldMatrix, this.localMatrix, this.worldMatrix);
        } else {
          // no matrix was passed in so just copy local to world
          copy(this.localMatrix, this.worldMatrix);
        }

        // now process all the children
        const worldMatrix = this.worldMatrix;
        for (const child of this.children) {
          child.updateWorldMatrix(worldMatrix);
        }
      }
      traverse(fn: (cur: Node) => void) {
        fn(this);
        for (const child of this.children) {
          child.traverse(fn);
        }
      }
      _addChild(child: Node): void {
        this.children.push(child);
      }
      _removeChild(child: Node) {
        const ndx = this.children.indexOf(child);
        this.children.splice(ndx, 1);
      }
    }

    class SkinRenderer {
      mesh: Record<string, any>;
      skin: Skin;

      constructor(mesh: Record<string, any>, skin: Skin) {
        this.mesh = mesh;
        this.skin = skin;
      }
      render(
        node: Node,
        projection: any,
        view: any,
        sharedUniforms: Record<string, any>
      ) {
        const { skin, mesh } = this;
        skin.update(node);
        gl.useProgram(skinProgramInfo.program);
        for (const primitive of mesh.primitives) {
          gl.bindVertexArray(primitive.vao);
          twgl.setUniforms(skinProgramInfo, {
            u_projection: projection,
            u_view: view,
            u_world: node.worldMatrix,
            u_jointTexture: skin.jointTexture,
            u_numJoints: skin.joints.length,
            ...primitive.material.uniforms,
            ...sharedUniforms,
          });
          twgl.drawBufferInfo(gl, primitive.bufferInfo);
        }
      }
    }

    function throwNoKey(key: string) {
      throw new Error(`no key: ${key}`);
    }

    const accessorTypeToNumComponentsMap = {
      SCALAR: 1,
      VEC2: 2,
      VEC3: 3,
      VEC4: 4,
      MAT2: 4,
      MAT3: 9,
      MAT4: 16,
    };

    function accessorTypeToNumComponents(type: string) {
      return (accessorTypeToNumComponentsMap as any)[type] || throwNoKey(type);
    }

    const glTypeToTypedArrayMap = {
      "5120": Int8Array, // gl.BYTE
      "5121": Uint8Array, // gl.UNSIGNED_BYTE
      "5122": Int16Array, // gl.SHORT
      "5123": Uint16Array, // gl.UNSIGNED_SHORT
      "5124": Int32Array, // gl.INT
      "5125": Uint32Array, // gl.UNSIGNED_INT
      "5126": Float32Array, // gl.FLOAT
    };

    // Given a GL type return the TypedArray needed
    function glTypeToTypedArray(type: any) {
      return (glTypeToTypedArrayMap as any)[type] || throwNoKey(type);
    }

    // given an accessor index return both the accessor and
    // a TypedArray for the correct portion of the buffer
    function getAccessorTypedArrayAndStride(
      gl: WebGL2RenderingContext,
      gltf: Record<string, any>,
      accessorIndex: number
    ) {
      const accessor = gltf.accessors[accessorIndex];
      const bufferView = gltf.bufferViews[accessor.bufferView];
      const TypedArray = glTypeToTypedArray(accessor.componentType);
      const buffer = gltf.buffers[bufferView.buffer];
      return {
        accessor,
        array: new TypedArray(
          buffer,
          bufferView.byteOffset + (accessor.byteOffset || 0),
          accessor.count * accessorTypeToNumComponents(accessor.type)
        ),
        stride: bufferView.byteStride || 0,
      };
    }

    // Given an accessor index return a WebGLBuffer and a stride
    function getAccessorAndWebGLBuffer(
      gl: WebGL2RenderingContext,
      gltf: Record<string, any>,
      accessorIndex: number,
      type?: number
    ) {
      const accessor = gltf.accessors[accessorIndex];
      const bufferView = gltf.bufferViews[accessor.bufferView];
      if (!bufferView.webglBuffer) {
        const buffer = gl.createBuffer();
        const target = bufferView.target || type || gl.ARRAY_BUFFER;
        const arrayBuffer = gltf.buffers[bufferView.buffer];
        // const TypedArray = glTypeToTypedArray(accessor.componentType);
        const data = new Uint8Array(
          arrayBuffer,
          bufferView.byteOffset,
          bufferView.byteLength
        );
        gl.bindBuffer(target, buffer);
        gl.bufferData(target, data, gl.STATIC_DRAW);
        bufferView.webglBuffer = buffer;
      }
      return {
        accessor,
        buffer: bufferView.webglBuffer,
        stride: bufferView.stride || 0,
      };
    }

    async function loadGLTF(url: string) {
      const gltf = await loadJSON(url);

      // load all the referenced files relative to the gltf file
      const baseURL = new URL(url, window.location.href);
      gltf.buffers = await Promise.all(
        gltf.buffers.map((buffer: Record<string, any>) => {
          const url = new URL(buffer.uri, baseURL.href);
          return loadBinary(url.href);
        })
      );

      const defaultMaterial = {
        uniforms: {
          u_diffuse: [0.5, 0.8, 1, 1],
        },
      };

      // setup meshes
      gltf.meshes.forEach((mesh: Record<string, any>) => {
        mesh.primitives.forEach((primitive: Record<string, any>) => {
          const attribs: Record<string, any> = {};
          let numElements;
          for (const [attribName, index] of Object.entries(
            primitive.attributes
          )) {
            const { accessor, buffer, stride } = getAccessorAndWebGLBuffer(
              gl,
              gltf,
              index as number
            );
            numElements = accessor.count;
            attribs[`a_${attribName}`] = {
              buffer,
              type: accessor.componentType,
              numComponents: accessorTypeToNumComponents(accessor.type),
              stride,
              offset: accessor.byteOffset | 0,
            };
          }

          const bufferInfo: Record<string, any> = {
            attribs,
            numElements,
          };

          if (primitive.indices !== undefined) {
            const { accessor, buffer } = getAccessorAndWebGLBuffer(
              gl,
              gltf,
              primitive.indices,
              gl.ELEMENT_ARRAY_BUFFER
            );
            bufferInfo.numElements = accessor.count;
            bufferInfo.indices = buffer;
            bufferInfo.elementType = accessor.componentType;
          }

          primitive.bufferInfo = bufferInfo;

          // make a VAO for this primitive
          // NOTE: This is problematic. In order to automagically
          // setup the attributes we need a ProgramInfo since a ProgramInfo
          // contains the type and size of each attribute. But, for this to
          // work for all situation we'd need a ProgramInfo that uses every
          // possible attribute and for all similar attributes to use the
          // same location. For this particular situation we use
          // skinProgramInfo and above where we compiled the shaders we
          // set the locations but for a larger program we'd need some other
          // solution
          primitive.vao = twgl.createVAOFromBufferInfo(
            gl,
            skinProgramInfo,
            primitive.bufferInfo
          );

          // save the material info for this primitive
          //   primitive.material =
          //     (gltf.materials && gltf.materials[primitive.material]) ||
          //     defaultMaterial;
          primitive.material =
            (gltf.materials && gltf.materials[primitive.material]) ||
            defaultMaterial;
        });
      });

      const skinNodes: Record<string, any>[] = [];
      const origNodes = gltf.nodes;
      gltf.nodes = gltf.nodes.map((n: Record<string, any>) => {
        const { name, skin, mesh, translation, rotation, scale } = n;
        const trs = new TRS(translation, rotation, scale);
        const node = new Node(trs, name);
        const realMesh = gltf.meshes[mesh];
        if (skin !== undefined) {
          skinNodes.push({ node, mesh: realMesh, skinNdx: skin });
        }
        return node;
      });
      // setup skins
      gltf.skins = gltf.skins.map((skin: Record<string, any>) => {
        const joints = skin.joints.map((ndx: number) => gltf.nodes[ndx]);
        const { stride, array } = getAccessorTypedArrayAndStride(
          gl,
          gltf,
          skin.inverseBindMatrices
        );
        return new Skin(joints, array);
      });

      // Add SkinRenderers to nodes with skins
      for (const { node, mesh, skinNdx } of skinNodes) {
        node.drawables.push(new SkinRenderer(mesh, gltf.skins[skinNdx]));
      }

      // arrange nodes into graph
      gltf.nodes.forEach((node: Node, ndx: number) => {
        const children = origNodes[ndx].children;
        if (children) {
          addChildren(gltf.nodes, node, children);
        }
      });

      // setup scenes
      for (const scene of gltf.scenes) {
        scene.root = new Node(new TRS(), scene.name);
        addChildren(gltf.nodes, scene.root, scene.nodes);
      }

      return gltf;
    }

    function addChildren(nodes: Node[], node: Node, childIndices: number[]) {
      childIndices.forEach((childNdx) => {
        const child = nodes[childNdx];
        child.setParent(node);
      });
    }

    async function loadFile(url: string, typeFunc: "arrayBuffer" | "json") {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`could not load: ${url}`);
      }
      return await response[typeFunc]();
    }

    async function loadBinary(url: string) {
      return loadFile(url, "arrayBuffer");
    }

    async function loadJSON(url: string) {
      return loadFile(url, "json");
    }

    function degToRad(deg: number) {
      return (deg * Math.PI) / 180;
    }

    const origMatrices = new Map();
    function animSkin(skin: Skin, a: number) {
      for (let i = 0; i < skin.joints.length; ++i) {
        const joint = skin.joints[i];
        // if there is no matrix saved for this joint
        if (!origMatrices.has(joint)) {
          // save a matrix for joint
          origMatrices.set(joint, joint.source.getMatrix());
        }
        // get the original matrix
        const origMatrix = origMatrices.get(joint);
        // rotate it
        // m.rotate(origMatrix, a, [1, 0, 0], qtn);
        // const m = m4.translation([10, 0, 0]);
        // const m = xRotate(origMatrix, a);
        // const m1 = m4.rotateX(origMatrix, a);
        // m4.scale(m, [1.2, 1.2, 1.2], m);
        // const t = m4.multiply(m4.translation([1, 1, 0]), m);
        // const m = m4.rotationX(a);
        // m4.multiply(t, m, m);
        // decompose it back into position, rotation, scale
        // into the joint
        // q.rotate()
        m.identity(mMatrix);
        m.rotate(origMatrix, a, [1, 0, 0], mMatrix);
        // q.rotate(a, [1, 0, 0], qtn);
        // q.toMatIV();
        // m.rotate(origMatrix, a, [1, 0, 0], qtn);
        decompose(
          mMatrix,
          joint.source.position,
          joint.source.rotation,
          joint.source.scale
        );
        // const sx = length(origMatrix.slice(0, 3));
        // const sy = length(origMatrix.slice(4, 7));
        // const sz = length(origMatrix.slice(8, 11));
        // joint.source.position = origMatrix.slice(12, 15);
        // joint.source.rotation = [...qtn];
        // joint.source.scale = [1, 1, 1];
      }
    }

    async function asyncRender() {
      const gltf = await loadGLTF("/assets/simpleMan2.6.gltf");
      let count = 0;
      function render(time: number) {
        time *= 0.001; // convert to seconds
        const rad = ((++count % 360) * Math.PI) / 180;

        twgl.resizeCanvasToDisplaySize(gl.canvas);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.clearColor(0.1, 0.1, 0.1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const fieldOfViewRadians = degToRad(60);
        const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        const projection = perspective(fieldOfViewRadians, aspect, 1, 2000);

        const cameraPosition = [5, 5, 10];
        const target = [0, 0, 0];
        // for debugging .. see article
        // const cameraPosition = [5, 0, 5];
        // const target = [0, 0, 0];
        const up = [0, 1, 0];
        // Compute the camera's matrix using look at.
        const camera = lookAt(cameraPosition, target, up);

        // Make a view matrix from the camera matrix.
        const view = inverse(camera);

        animSkin(gltf.skins[0], Math.sin(time) * 0.5);
        // animSkin(gltf.skins[0], rad);
        // animSkin(gltf.skins[0], 0.4862552294793057);

        const sharedUniforms = {
          u_lightDirection: normalize([-1, 3, 5]),
        };

        function renderDrawables(node: Node) {
          for (const drawable of node.drawables) {
            drawable.render(node, projection, view, sharedUniforms);
          }
        }

        for (const scene of gltf.scenes) {
          // updatte all world matices in the scene.
          scene.root.updateWorldMatrix();
          // walk the scene and render all renderables
          scene.root.traverse(renderDrawables);
        }

        requestAnimationFrame(render);
      }
      requestAnimationFrame(render);
    }
    asyncRender();
  }, []);

  return (
    <div>
      <canvas ref={cavRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
    </div>
  );
}
