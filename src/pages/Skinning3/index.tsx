import React, { useRef, useEffect } from "react";
import axios from "axios";
import { Box } from "@mui/material";
import * as twgl from "twgl.js";

const { m4, primitives, v3 } = twgl;
// interface Attribute{

// }

// interface Primitive{

// }

// interface MeshInfo{

// }

/**
 * creates a matrix from translation, quaternion, scale
 * @param {Number[]} translation [x, y, z] translation
 * @param {Number[]} quaternion [x, y, z, z] quaternion rotation
 * @param {Number[]} scale [x, y, z] scale
 * @param {Matrix4} [dst] optional matrix to store result
 * @return {Matrix4} dst or a new matrix if none provided
 */
function compose(
  translation: number[],
  quaternion: number[],
  scale: number[],
  dst: twgl.m4.Mat4
): twgl.m4.Mat4 {
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

function quatFromRotationMatrix(m: twgl.m4.Mat4, dst: twgl.m4.Mat4) {
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

function determinate(m: twgl.m4.Mat4) {
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
  mat: twgl.m4.Mat4,
  translation: twgl.v3.Vec3,
  quaternion: number[],
  scale: number[]
) {
  let sx = v3.length(mat.slice(0, 3));
  const sy = v3.length(mat.slice(4, 7));
  const sz = v3.length(mat.slice(8, 11));

  // if determinate is negative, we need to invert one scale
  const det = determinate(mat);
  if (det < 0) {
    sx = -sx;
  }

  translation[0] = mat[12];
  translation[1] = mat[13];
  translation[2] = mat[14];

  // scale the rotation part
  const matrix = m4.copy(mat);

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
}

class Node {
  constructor(source: any, name: string) {}
}

const loadJSON = async (url: string) => {
  return await axios({
    url,
    responseType: "json",
  });
};

const loadFile = async (url: string) => {
  return await axios({
    url,
    responseType: "arraybuffer",
  });
};

async function loadGltf(url: string) {
  const gltf: Record<string, any> = await loadJSON(url);
  const baseURL = new URL(url, window.location.href);
  gltf.buffers = Promise.all(
    gltf.buffers.map((buffer: Record<string, any>) => {
      const target = new URL(buffer.uri, baseURL.href);
      return loadFile(target.href);
    })
  );
}

export default function Skinning3() {
  const cavRef = useRef<HTMLCanvasElement>(null);

  // 1.加载gltf文件，再加载buffer
  // 将mesh文件内容生成bufferInfo
  // 创建Node对象
  // 创建Skin对象
  // 将node对象生成层级
  // 遍历scenes生成场景层级

  useEffect(() => {}, []);

  return (
    <Box sx={{ position: "relative" }}>
      <canvas ref={cavRef} width={1200} height={800} />
    </Box>
  );
}
