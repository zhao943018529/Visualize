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
uniform sampler2D boneMatrixTexture;
uniform float numBones;

// these offsets assume the texture is 4 pixels across
#define ROW0_U ((0.5 + 0.0) / 4.)
#define ROW1_U ((0.5 + 1.0) / 4.)
#define ROW2_U ((0.5 + 2.0) / 4.)
#define ROW3_U ((0.5 + 3.0) / 4.)

mat4 getBoneMatrix(float boneNdx) {
  float v = (boneNdx + 0.5) / numBones;
  return mat4(
    texture2D(boneMatrixTexture, vec2(ROW0_U, v)),
    texture2D(boneMatrixTexture, vec2(ROW1_U, v)),
    texture2D(boneMatrixTexture, vec2(ROW2_U, v)),
    texture2D(boneMatrixTexture, vec2(ROW3_U, v)));
}

void main() {

  gl_Position = projection * view *
                (getBoneMatrix(boneNdx[0]) * position * weight[0] +
                 getBoneMatrix(boneNdx[1]) * position * weight[1] +
                 getBoneMatrix(boneNdx[2]) * position * weight[2] +
                 getBoneMatrix(boneNdx[3]) * position * weight[3]);

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
    // debugger;
    const gl = cavElem.getContext('webgl') as WebGLRenderingContext;
    // const gl = twgl.getContext(cavElem);
    // var extensions = gl.getSupportedExtensions();
    var ext = gl.getExtension("OES_texture_float");
    if (!ext) {
      console.log("not support OES_texture_float");
      return;
    }
    // var ext = gl.getExtension("OES_texture_float_linear");
    // if (!ext) {
    //   console.log("not support OES_texture_float_linear");
    //   return;
    // }
    const programInfo = twgl.createProgramInfo(gl, [
      VERTEX_SHADER_ID,
      FRAME_SHADER_ID,
    ]);
    const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);
    const numBones = 4;
    const boneArray = new Float32Array(numBones * 16);

    const boneMatrixTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, boneMatrixTexture);
    // since we want to use the texture for pure data we turn
    // off filtering
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    // also turn off wrapping since the texture might not be a power of 2
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const uniforms = {
      projection: m4.ortho(-20, 20, -10, 10, -1, 1),
      view: m4.translation([-6, 0, 0]),
      color: [1, 0, 0, 1],
      numBones,
      boneMatrixTexture,
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
      gl.bindTexture(gl.TEXTURE_2D, boneMatrixTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0, // level
        gl.RGBA, // internal format
        4, // width 4 pixels, each pixel has RGBA so 4 pixels is 16 values
        numBones, // one row per bone
        0, // border
        gl.RGBA, // format
        gl.FLOAT, // type
        boneArray
      );
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
