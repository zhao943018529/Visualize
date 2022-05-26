import React, { useRef, useEffect } from "react";
import * as twgl from "twgl.js";
import { deg2radians } from "../../utils/math";

import styles from "./index.module.scss";

const { primitives, m4 } = twgl;

const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 960;

const VERTEX_ID = "vertex-id";
const FRAGMENT_ID = "fragment-id";

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

export default function CanvasText() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const textCavRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const textCavElem = textCavRef.current as HTMLCanvasElement;
    const ctx = textCavElem.getContext("2d");
    const gl = twgl.getWebGLContext(cavElem);
    const programInfo = twgl.createProgramInfo(gl, [VERTEX_ID, FRAGMENT_ID]);
    const cubeBufferInfo = primitives.createCubeBufferInfo(gl, 60);

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

    const pointVec = [30, 30, 30];
    const translation = [0, 30, -360];
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
      rotation[2] += deltaTime;
      twgl.resizeCanvasToDisplaySize(gl.canvas);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      ctx?.clearRect(0, 0, textCavElem.width, textCavElem.height);
      gl.enable(gl.CULL_FACE);
      gl.enable(gl.DEPTH_TEST);
      gl.useProgram(programInfo.program);

      const aspect = gl.canvas.width / gl.canvas.height;
      const projectionMatrix = m4.perspective(
        fieldOfViewRadians,
        aspect,
        1,
        2000
      );

      let spread = 170;
      for (let ii = -1; ii <= 1; ++ii) {
        for (let jj = -2; jj <= 2; ++jj) {
          let matrix = m4.translate(projectionMatrix, [
            translation[0] + spread * ii,
            translation[1] + spread * jj,
            translation[2],
          ]);
          matrix = m4.rotateX(matrix, rotation[0]);
          matrix = m4.rotateY(matrix, rotation[1] + ii * jj * 0.2);
          matrix = m4.rotateZ(matrix, rotation[2] + (jj * 3 + ii) * 0.1);
          matrix = m4.translate(matrix, [-50, -75, 0]);
          twgl.setUniforms(programInfo, {
            u_viewProjectionMatrix: matrix,
            u_texture: targetTexture,
          });
          twgl.setBuffersAndAttributes(gl, programInfo, cubeBufferInfo);
          twgl.drawBufferInfo(gl, cubeBufferInfo, gl.TRIANGLES);
          const clipspace = m4.transformPoint(matrix, pointVec);
          const pixelX = (clipspace[0] * 0.5 + 0.5) * gl.canvas.width;
          const pixelY = (clipspace[1] * -0.5 + 0.5) * gl.canvas.height;
          ctx?.fillText(`${ii},${jj}`, pixelX, pixelY);
        }
      }

      requestAnimationFrame(drawScene);
    }

    requestAnimationFrame(drawScene);
  }, []);

  return (
    <div className={styles.container}>
      <canvas ref={cavRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT}></canvas>
      <canvas
        ref={textCavRef}
        className={styles.mycanvas}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
      />
      <script id={VERTEX_ID} type="notjs">
        {vertexStr}
      </script>
      <script id={FRAGMENT_ID} type="notjs">
        {fragmentStr}
      </script>
    </div>
  );
}
