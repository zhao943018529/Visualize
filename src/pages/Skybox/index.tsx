import React, { useRef, useEffect, useState } from "react";
import * as twgl from "twgl.js";
import { deg2radians } from "../../utils/math";

const { m4, primitives } = twgl;

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 640;

const VERTEX_ID = "vertex-id";
const FRAGMENT_ID = "fragment-id";

const vertexStr = `
    attribute vec4 position;

    varying vec4 v_position;

    void main() {
        v_position = position;
        gl_Position = position;
        gl_Position.z = 1.0;
    }
`;
const fragmentStr = `
    precision mediump float;

    uniform samplerCube u_skybox;
    uniform mat4 u_inverseViewProjectionMatrix;

    varying vec4 v_position;

    void main() {
        vec4 position = u_inverseViewProjectionMatrix * v_position;
        gl_FragColor = textureCube(u_skybox, normalize(position.xyz / position.w));
    }
`;

export default function Skybox() {
  const cavRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem) as WebGLRenderingContext;
    const programInfo = twgl.createProgramInfo(gl, [VERTEX_ID, FRAGMENT_ID]);
    const rectangleBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: {
        numComponents: 2,
        data: [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1],
      },
      indices: {
        numComponents: 3,
        data: [0, 1, 2, 3, 4, 5],
      },
    });
    // const positionLocation = gl.getAttribLocation(
    //   programInfo.program,
    //   "position"
    // );
    // function setGeometry(gl: WebGLRenderingContext) {
    //   var positions = new Float32Array([
    //     -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    //   ]);
    //   gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    // }
    // var positionBuffer = gl.createBuffer();
    // // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
    // gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // // Put the positions in the buffer
    // setGeometry(gl);

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

    const fieldOfViewRadians = deg2radians(60);

    function drawScene(time: number) {
      time *= 0.001;

      twgl.resizeCanvasToDisplaySize(gl.canvas);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

      gl.enable(gl.CULL_FACE);
      gl.enable(gl.DEPTH_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.useProgram(programInfo.program);
    //   gl.enableVertexAttribArray(positionLocation);

    //   // Bind the position buffer.
    //   gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    //   // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    //   var size = 2; // 2 components per iteration
    //   var type = gl.FLOAT; // the data is 32bit floats
    //   var normalize = false; // don't normalize the data
    //   var stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
    //   var offset = 0; // start at the beginning of the buffer
    //   gl.vertexAttribPointer(
    //     positionLocation,
    //     size,
    //     type,
    //     normalize,
    //     stride,
    //     offset
    //   );
      const aspect = gl.canvas.width / gl.canvas.height;
      const projectionMatrix = m4.perspective(
        fieldOfViewRadians,
        aspect,
        1,
        2000
      );
      const cameraPosition = [Math.cos(time * 0.1), 0, Math.sin(time * 0.1)];
      const target = [0, 0, 0];
      const up = [0, 1, 0];
      const cameraMatrix = m4.lookAt(cameraPosition, target, up);
      const viewMatrix = m4.inverse(cameraMatrix);
      const viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);
      const inverseViewProjectionMatrix = m4.inverse(viewProjectionMatrix);
      twgl.setUniforms(programInfo, {
        u_skybox: targetTexture,
        u_inverseViewProjectionMatrix: inverseViewProjectionMatrix,
      });
        twgl.setBuffersAndAttributes(gl, programInfo, rectangleBufferInfo);
        twgl.drawBufferInfo(gl, rectangleBufferInfo, gl.TRIANGLES);
      gl.depthFunc(gl.LEQUAL);

      // Draw the geometry.
    //   gl.drawArrays(gl.TRIANGLES, 0, 1 * 6);

      requestAnimationFrame(drawScene);
    }
    requestAnimationFrame(drawScene);
  }, []);

  return (
    <div>
      <canvas ref={cavRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
      <script id={VERTEX_ID} type="notjs">
        {vertexStr}
      </script>
      <script id={FRAGMENT_ID} type="notjs">
        {fragmentStr}
      </script>
    </div>
  );
}
