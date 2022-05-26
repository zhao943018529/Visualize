import React, { useRef, useEffect } from "react";
import * as twgl from "twgl.js";
import { deg2radians } from "../../utils/math";

const { primitives, m4 } = twgl;

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 960;

const arrays = {
  position: {
    numComponents: 2,
    data: [
      0,
      1, // 0
      0,
      -1, // 1
      2,
      1, // 2
      2,
      -1, // 3
      4,
      1, // 4
      4,
      -1, // 5
      6,
      1, // 6
      6,
      -1, // 7
      8,
      1, // 8
      8,
      -1, // 9
    ],
  },
  boneNdx: {
    numComponents: 4,
    data: [
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
    ],
  },
  weight: {
    numComponents: 4,
    data: [
      1,
      0,
      0,
      0, // 0
      1,
      0,
      0,
      0, // 1
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
    ],
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
};

const vertexShaderStr = `
    attribute vec4 position;
    attribute vec4 weight;
    attribute vec4 boneNdx;

    uniform mat4 projection;
    uniform mat4 view;
    uniform mat4 bones[4];

    void main() {

        gl_Position = projection * view *
                    (bones[int(boneNdx[0])] * position * weight[0] +
                    bones[int(boneNdx[1])] * position * weight[1] +
                    bones[int(boneNdx[2])] * position * weight[2] +
                    bones[int(boneNdx[3])] * position * weight[3]);

    }
`;

const frameShaderStr = `
    precision mediump float;
    uniform vec4 color;

    void main () {
        gl_FragColor = color;
    }
`;

const VERTEX_SHADER_ID = "vertex-shader";
const FRAME_SHADER_ID = "frame-shader";

export default function Skinning() {
  const cavRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getContext(cavElem);
    const programInfo = twgl.createProgramInfo(gl, [
      VERTEX_SHADER_ID,
      FRAME_SHADER_ID,
    ]);
    const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);
    const numBones = 4;
    const boneArray = new Float32Array(numBones * 16);

    const uniforms = {
      projection: m4.ortho(-20, 20, -10, 10, -1, 1),
      view: m4.translation([-6, 0, 0]),
      bones: boneArray,
      color: [1, 0, 0, 1],
    };
    const boneMatrices: Float32Array[] = [];
    const bones: twgl.m4.Mat4[] = [];
    const bindPose: twgl.m4.Mat4[] = [];

    for (let i = 0; i < numBones; ++i) {
      boneMatrices.push(new Float32Array(boneArray.buffer, i * 4 * 16, 16));
      bones.push(m4.identity());
      bindPose.push(m4.identity());
    }

    function computeBoneMatrices(bones: any[], angle: number) {
      const mat = m4.identity();
      m4.rotateZ(mat, angle, bones[0]);
      m4.translate(bones[0], [4, 0, 0], mat);
      m4.rotateZ(mat, angle, bones[1]);
      m4.translate(bones[1], [4, 0, 0], mat);
      m4.rotateZ(mat, angle, bones[2]);
    }
    computeBoneMatrices(bindPose, 0);

    const bindPoseInv = bindPose.map(function (m) {
      return m4.inverse(m);
    });

    function render(time: number) {
      twgl.resizeCanvasToDisplaySize(gl.canvas);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
      m4.ortho(-aspect * 10, aspect * 10, -10, 10, -1, 1, uniforms.projection);
      const angle = Math.sin(time * 0.001) * 0.8;
      computeBoneMatrices(bones, angle);
      bones.forEach((bone, ndx) => {
        m4.multiply(bone, bindPoseInv[ndx], boneMatrices[ndx]);
      });
      gl.useProgram(programInfo.program);
      twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
      twgl.setUniforms(programInfo, uniforms);
      twgl.drawBufferInfo(gl, bufferInfo, gl.LINES);
      //   debugger;
      // gl.drawElements(gl.LINES, bufferInfo.numElements, gl.UNSIGNED_SHORT, 0);
      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  }, []);

  return (
    <div>
      <canvas ref={cavRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
      <script id={VERTEX_SHADER_ID} type="notjs">
        {vertexShaderStr}
      </script>
      <script id={FRAME_SHADER_ID} type="notjs">
        {frameShaderStr}
      </script>
    </div>
  );
}
