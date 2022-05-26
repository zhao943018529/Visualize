import React, { useRef, useEffect, useCallback, useMemo } from "react";
import * as twgl from "twgl.js";
import { deg2radians } from "../../utils/math";

import styles from "./index.module.scss";

const { primitives, m4 } = twgl;

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 860;

const VERTEX_ID = "vertex-id";
const FRAGMENT_ID = "fragment-id";
const TEXT_VERTEX_ID = "text-vertex-id";
const TEXT_FRAGMENT_ID = "text-fragment-id";

const vertexStr = `
    attribute vec4 position;

    uniform mat4 u_viewProjectionMatrix;

    varying vec4 v_position;

    void main() {
        v_position = position;
        gl_Position = u_viewProjectionMatrix * position;
    }
`;
const fragmentStr = `
    precision mediump float;

    uniform samplerCube u_texture;

    varying vec4 v_position;

    void main() {
        vec4 color = textureCube(u_texture, normalize(v_position.xyz));
        gl_FragColor = color;
    }

`;

const textVertexStr = `
    attribute vec4 position;
    attribute vec2 texcoord;

    uniform mat4 u_matrix;

    varying vec2 v_texcoord;

    void main() {
      gl_Position = u_matrix * position;
      v_texcoord = texcoord;
    }
`;

const textFragmentStr = `
    precision mediump float;

    uniform sampler2D u_texture;
    uniform vec4 u_color;

    varying vec2 v_texcoord;

    void main() {
      gl_FragColor = texture2D(u_texture, v_texcoord) * u_color;
    }
`;

const dailyWords = [
  "I",
  "am",
  "optima",
  "and",
  "I",
  "send",
  "this",
  "message",
  "to",
  "any",
  "surviving",
  "Autobots",
  "taking",
  "refuge",
  "among",
  "the",
  "stars",
];

const dailyColors = [
  [0.0, 0.0, 0.0, 1], // 0
  [1.0, 0.0, 0.0, 1], // 1
  [0.0, 1.0, 0.0, 1], // 2
  [1.0, 1.0, 0.0, 1], // 3
  [0.0, 0.0, 1.0, 1], // 4
  [1.0, 0.0, 1.0, 1], // 5
  [0.0, 1.0, 1.0, 1], // 6
  [0.5, 0.5, 0.5, 1], // 7
  [0.5, 0.0, 0.0, 1], // 8
  [0.0, 0.0, 0.0, 1], // 9
  [0.5, 5.0, 0.0, 1], // 10
  [0.0, 5.0, 0.0, 1], // 11
  [0.5, 0.0, 5.0, 1], // 12,
  [0.0, 0.0, 5.0, 1], // 13,
  [0.5, 5.0, 5.0, 1], // 14,
  [0.0, 5.0, 5.0, 1], // 15,
];

function normalize(v: any, dst?: any) {
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

export default function CanvasText() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  // const textCavRef = useRef<HTMLCanvasElement>(null);

  const makeCanvasText = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      text: string,
      width: number,
      height: number
    ) => {
      ctx.canvas.width = width;
      ctx.canvas.height = height;
      ctx.font = "20px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "white";
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fillText(text, width / 2, height / 2);

      return ctx.canvas;
    },
    []
  );

  const createTextures = useCallback(
    (gl: WebGLRenderingContext, ctx: CanvasRenderingContext2D) =>
      dailyWords.slice(0, 16).map((word) => {
        const textCanvas = makeCanvasText(ctx, word, 100, 26);
        const textWidth = textCanvas.width;
        const textHeight = textCanvas.height;
        const texture = gl.createTexture() as WebGLTexture;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          textCanvas
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        return {
          texture,
          width: textWidth,
          height: textHeight,
        };
      }),
    []
  );

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const textCavElem = document.createElement("canvas");
    const ctx = textCavElem.getContext("2d") as CanvasRenderingContext2D;
    const gl = twgl.getWebGLContext(cavElem);
    const programInfo = twgl.createProgramInfo(gl, [VERTEX_ID, FRAGMENT_ID]);
    const textProgramInfo = twgl.createProgramInfo(gl, [
      TEXT_VERTEX_ID,
      TEXT_FRAGMENT_ID,
    ]);
    const cubeBufferInfo = primitives.createCubeBufferInfo(gl, 60);
    const textBufferInfo = primitives.createPlaneBufferInfo(
      gl,
      1,
      1,
      1,
      1,
      m4.rotationX(Math.PI / 2)
    );
    console.log(textBufferInfo);

    const allTextures = createTextures(gl, ctx);

    const targetTexture = twgl.createTexture(gl, {
      target: gl.TEXTURE_CUBE_MAP,
      src: [
        "/pos-x.jpg",
        "/neg-x.jpg",
        "/pos-y.jpg",
        "/neg-y.jpg",
        "/pos-z.jpg",
        "/neg-z.jpg",
      ],
    });
    const translation = [0, 30, 0];
    const scales = [1, 1, 1];
    const rotation = [deg2radians(190), deg2radians(0), deg2radians(0)];
    const fieldOfViewRadians = deg2radians(60);
    let then = 0;
    let rotationSpeed = 1.2;
    //
    function drawScene(time: number) {
      time *= 0.001;

      const deltaTime = time - then;
      then = time;
      rotation[1] += rotationSpeed * deltaTime;
      // rotation[2] += deltaTime;
      twgl.resizeCanvasToDisplaySize(gl.canvas);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.enable(gl.CULL_FACE);
      gl.enable(gl.DEPTH_TEST);
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(programInfo.program);

      const aspect = gl.canvas.width / gl.canvas.height;
      const projectionMatrix = m4.perspective(
        fieldOfViewRadians,
        aspect,
        1,
        2000
      );
      const cameraRadius = 420;
      const cameraPosition = [
        Math.cos(time) * cameraRadius,
        0,
        Math.sin(time) * cameraRadius,
      ];
      const target = [0, 0, 0];
      const up = [0, 1, 0];
      const cameraMatrix = m4.lookAt(cameraPosition, target, up);
      const viewMatrix = m4.inverse(cameraMatrix);

      twgl.setBuffersAndAttributes(gl, programInfo, cubeBufferInfo);
      const textPositions = [];
      let spread = 100;
      let textPos = 0;
      for (let ii = -1; ii <= 1; ++ii) {
        for (let jj = -2; jj <= 2; ++jj) {
          let matrix = m4.translate(viewMatrix, [
            translation[0] + spread * ii,
            translation[1] + spread * jj,
            translation[2],
          ]);
          matrix = m4.rotateX(matrix, rotation[0]);
          matrix = m4.rotateY(matrix, rotation[1] + ii * jj * 0.2);
          matrix = m4.rotateZ(matrix, rotation[2] + time + (jj * 3 + ii) * 0.1);
          matrix = m4.translate(matrix, [-30, -30, -30]);
          matrix = m4.scale(matrix, scales);

          textPositions.push({
            texture: allTextures[textPos++],
            position: [matrix[12], matrix[13], matrix[14]],
          });
          matrix = m4.multiply(projectionMatrix, matrix);

          twgl.setUniforms(programInfo, {
            u_viewProjectionMatrix: matrix,
            u_texture: targetTexture,
          });

          twgl.drawBufferInfo(gl, cubeBufferInfo, gl.TRIANGLES);
        }
      }

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.useProgram(textProgramInfo.program);
      twgl.setBuffersAndAttributes(gl, textProgramInfo, textBufferInfo);
      textPositions.forEach((cur, index) => {
        const { position, texture } = cur;
        const fromEye = normalize(position);
        const distance = 60;
        const viewX = position[0] - fromEye[0] * distance;
        const viewY = position[1] - fromEye[1] * distance;
        const viewZ = position[2] - fromEye[2] * distance;

        const scale = (viewZ * -1) / gl.canvas.height;
        let textMatrix = m4.translate(projectionMatrix, [viewX, viewY, viewZ]);
        // console.log(texture.width+'--'+scale);
        textMatrix = m4.scale(textMatrix, [
          texture.width * scale,
          texture.height * scale,
          1,
        ]);
        twgl.setUniforms(textProgramInfo, {
          u_texture: texture.texture,
          u_matrix: textMatrix,
          u_color: dailyColors[index],
        });
        twgl.drawBufferInfo(gl, textBufferInfo, gl.TRIANGLES);
      });

      requestAnimationFrame(drawScene);
    }

    requestAnimationFrame(drawScene);
  }, []);

  return (
    <div className={styles.container}>
      <canvas ref={cavRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}></canvas>
      <script id={VERTEX_ID} type="notjs">
        {vertexStr}
      </script>
      <script id={FRAGMENT_ID} type="notjs">
        {fragmentStr}
      </script>
      <script id={TEXT_VERTEX_ID} type="notjs">
        {textVertexStr}
      </script>
      <script id={TEXT_FRAGMENT_ID} type="notjs">
        {textFragmentStr}
      </script>
    </div>
  );
}
