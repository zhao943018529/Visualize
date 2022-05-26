import React, { useRef, useState, useEffect } from "react";
import {
  getGraphContext,
  programHelper,
  shaderHelper,
  renderElements,
  loadImageTexure,
  createCube,
  randomColor,
} from "../../utils";
import { deg2radians } from "../../utils/math";

import {
  ortho,
  identity,
  rotationX,
  rotationY,
  multiply,
} from "../../utils/matrix";

const vertexStr = `
    precision mediump float;

    attribute vec3 a_Position;
    attribute vec4 a_Color;
    varying vec4 v_Color;
    uniform mat4 u_Matrix;

    void main() {
        gl_Position = u_Matrix * vec4(a_Position, 1);
        v_Color = a_Color;
        gl_PointSize = 5.0;
    }
  `;

const fragmentStr = `
    precision mediump float;
    varying vec4 v_Color;

    void main() {
        gl_FragColor = v_Color;
    }
  `;

const positions = [
  // front
  -0.5, -0.5, 0.5, 1, 0, 0, 1, 0.5, -0.5, 0.5, 1, 0, 0, 1, 0.5, 0.5, 0.5, 1, 0,
  0, 1, -0.5, 0.5, 0.5, 1, 0, 0, 1,
  // back
  -0.5, 0.5, 0.5, 0, 1, 0, 1, -0.5, 0.5, -0.5, 0, 1, 0, 1, -0.5, -0.5, -0.5, 0,
  1, 0, 1, -0.5, -0.5, 0.5, 0, 1, 0, 1,
  // left
  0.5, 0.5, 0.5, 0, 0, 1, 1, 0.5, -0.5, 0.5, 0, 0, 1, 1, 0.5, -0.5, -0.5, 0, 0,
  1, 1, 0.5, 0.5, -0.5, 0, 0, 1, 1,
  // 1
  0.5, 0.5, -0.5, 1, 0, 1, 1, 0.5, -0.5, -0.5, 1, 0, 1, 1, -0.5, -0.5, -0.5, 1,
  0, 1, 1, -0.5, 0.5, -0.5, 1, 0, 1, 1,
  // 2
  -0.5, 0.5, 0.5, 1, 1, 0, 1, 0.5, 0.5, 0.5, 1, 1, 0, 1, 0.5, 0.5, -0.5, 1, 1,
  0, 1, -0.5, 0.5, -0.5, 1, 1, 0, 1,
  // 3
  -0.5, -0.5, 0.5, 0, 1, 1, 1, -0.5, -0.5, -0.5, 0, 1, 1, 1, 0.5, -0.5, -0.5, 0,
  1, 1, 1, 0.5, -0.5, 0.5, 0, 1, 1, 1,
];

export default function Cube2() {
  const cavRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const elem = cavRef.current as HTMLCanvasElement;
    const gl = getGraphContext(elem) as WebGLRenderingContext;
    const vertexShader = shaderHelper(gl, gl.VERTEX_SHADER, vertexStr);
    const fragmentShader = shaderHelper(gl, gl.FRAGMENT_SHADER, fragmentStr);
    const program = programHelper(gl, vertexShader, fragmentShader);
    gl.useProgram(program);
    const indices = [
      0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12,
      14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
    ];
    const u_Matrix = gl.getUniformLocation(program, "u_Matrix");
    const a_Position = gl.getAttribLocation(program, "a_Position");
    const a_Color = gl.getAttribLocation(program, "a_Color");
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    const indicesBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(a_Position);
    gl.enableVertexAttribArray(a_Color);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 28, 0);
    gl.vertexAttribPointer(a_Color, 4, gl.FLOAT, false, 28, 12);
    gl.clearColor(0, 0, 0, 1);
    gl.enable(gl.CULL_FACE);
    const aspect = elem.width / elem.height;
    const destMatrix = identity(null);
    const tempMatrix = identity(null);
    const projectionMatrix = ortho(
      -aspect * 4,
      aspect * 4,
      -4,
      4,
      100,
      -100,
      null
    );

    let xAngle = 0;
    let yAngle = 0;

    function render() {
      ++xAngle;
      ++yAngle;
      rotationX(deg2radians(xAngle), destMatrix);
      multiply(
        destMatrix,
        rotationY(deg2radians(yAngle), tempMatrix),
        destMatrix
      );
      multiply(projectionMatrix, destMatrix, destMatrix);
      gl.uniformMatrix4fv(u_Matrix, false, destMatrix);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
      requestAnimationFrame(render);
    }
    render();
  }, []);

  return (
    <div style={{ margin: "120px auto" }}>
      <canvas ref={cavRef} style={{ width: 600, height: 400 }} />
    </div>
  );
}
