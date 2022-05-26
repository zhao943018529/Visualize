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

const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 512;

const vertexStr = `
    #version 300 es
    in vec2 position;
    in vec4 weight;
    in uvec4 boneNdx;
    
    uniform mat4 bones[4];
    uniform mat4 view;
    uniform mat4 projection;

    void main() {
        vec4 position4 = vec4(position, 0.0, 1.0);
        gl_Position = projection * view * 
                        ( bones[boneNdx[0]] * position4 * weight[0] +
                          bones[boneNdx[1]] * position4 * weight[1] +
                          bones[boneNdx[2]] * position4 * weight[2] +
                          bones[boneNdx[3]] * position4 * weight[3]);
    }
`;
const fragmentStr = `
    #version 300 es
    precision highp float;
    uniform vec4 color;
    out vec4 outColor;
    void main () {
    outColor = color;
    }    
`;

export default function Skeleton() {
  const cavRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getContext(cavElem);
    const programInfo = twgl.createProgramInfo(gl, [vertexStr, fragmentStr]);
    const position = [
      0, 1, 0, -1, 2, 1, 2, -1, 4, 1, 4, -1, 6, 1, 6, -1, 8, 1, 8, -1,
    ];
    const boneNdx = [
      0,
      0,
      0,
      0, // 0
      0,
      0,
      0,
      0, // 1
      0,
      1,
      0,
      0, // 2
      0,
      1,
      0,
      0, // 3
      1,
      0,
      0,
      0, // 4
      1,
      0,
      0,
      0, // 5
      1,
      2,
      0,
      0, // 6
      1,
      2,
      0,
      0, // 7
      2,
      0,
      0,
      0, // 8
      2,
      0,
      0,
      0, // 9
    ];
    const weight = [
      1,
      0,
      0,
      0, //0
      1,
      0,
      0,
      0, //1
      0.5,
      0.5,
      0,
      0, // 2
      0.5,
      0.5,
      0,
      0, // 3
      1,
      0,
      0,
      0, // 4
      1,
      0,
      0,
      0, // 5
      0.5,
      0.5,
      0,
      0, // 6
      0.5,
      0.5,
      0,
      0, // 7
      1,
      0,
      0,
      0, // 8
      1,
      0,
      0,
      0, // 9
    ];
    const boneBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: {
        data: position,
        numComponents: 2,
      },
      boneNdx: {
        data: new Uint8Array(boneNdx),
        numComponents: 4,
      },
      weight: {
        data: weight,
        numComponents: 4,
      },
      indices: {
        numComponents: 2,
        data: [
          0,
          1,
          0,
          2,
          1,
          3,
          2,
          3, //
          2,
          4,
          3,
          5,
          4,
          5,
          4,
          6,
          5,
          7, //
          6,
          7,
          6,
          8,
          7,
          9,
          8,
          9,
        ],
      },
    });
    const numBones = 4;
    const boneArray = new Float32Array(numBones * 16);
    const m = new matIV();
    const vMatrix = m.identity(m.create());
    const pMatrix = m.identity(m.create());
    m.ortho(-20, 20, -10, 10, -1, 1, pMatrix);
    m.translate(vMatrix, [-6, 0, 0], vMatrix);

    // 初始化骨架矩阵
    const boneMatrices: any[] = [];
    const bones: any[] = [];
    const bindPose = [];
    const bindPoseInv: any[] = [];
    for (let i = 0; i < numBones; i++) {
      boneMatrices.push(new Float32Array(boneArray.buffer, i * 4 * 16, 16));
      bindPose.push(m.identity(m.create()));
      bones.push(m.identity(m.create()));
      bindPoseInv.push(m.identity(m.create()));
    }

    function computeBoneMatrices(bones: any, angle: any) {
      const current = m.identity(m.create());
      m.rotate(current, angle, [0, 0, 1], bones[0]);
      m.translate(bones[0], [4, 0, 0], current);
      m.rotate(current, angle, [0, 0, 1], bones[1]);
      m.translate(bones[1], [4, 0, 0], current);
      m.rotate(current, angle, [0, 0, 1], bones[2]);
    }

    computeBoneMatrices(bones, 0);
    bones.forEach((bone, i) => m.inverse(bone, bindPoseInv[i]));

    function render(time: number) {
      time *= 0.001;
      twgl.resizeCanvasToDisplaySize(gl.canvas);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      const aspect = gl.canvas.width / gl.canvas.height;
      m.ortho(-aspect * 10, aspect * 10, -10, 10, -1, 1, pMatrix);

      const angle = Math.sin(time) * 0.8;

      computeBoneMatrices(bones, angle);
      bindPoseInv.forEach((boneInv, i) => {
        m.multiply(bones[i], boneInv, boneMatrices[i]);
      });

      gl.useProgram(programInfo.program);
      twgl.setBuffersAndAttributes(gl, programInfo, boneBufferInfo);
      twgl.setUniforms(programInfo, {
        projection: pMatrix,
        view: vMatrix,
        bones: boneArray,
        color: [1, 0, 0, 1],
      });
      twgl.drawBufferInfo(gl, boneBufferInfo, gl.LINES);

      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
  }, []);

  return (
    <div>
      <canvas ref={cavRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
    </div>
  );
}
