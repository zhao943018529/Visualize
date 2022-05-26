import React, { useRef, useState, useEffect } from "react";
import {
  getGraphContext,
  programHelper,
  shaderHelper,
  renderElements,
  loadImageTexure,
  createCube,
} from "../../utils";
import { deg2radians } from "../../utils/math";
import { createSphere, createSphere2 } from "../../utils/geometry";

import {
  ortho,
  identity,
  rotationX,
  rotationY,
  multiply,
  perspective,
} from "../../utils/matrix";

const vertexStr = `
    precision mediump float;

    attribute vec3 a_Position;
    attribute vec4 a_Color;
    attribute vec3 a_Screen_Size;
    varying vec4 v_Color;
    uniform mat4 u_Matrix;

    void main() {
        vec3 position = (a_Position / a_Screen_Size) * 2.0 - 1.0;
        position = vec3(1.0, -1.0, 1.0) * position;
        gl_Position = u_Matrix * vec4(position, 1.0);
        v_Color = a_Color;
    }
  `;

const fragmentStr = `
    precision mediump float;
    varying vec4 v_Color;

    void main() {
        gl_FragColor = v_Color;
    }
  `;

// const positions = [
//   // front
//   -100, -100, 100, 1, 0, 0, 1, 100, -100, 100, 1, 0, 0, 1, 100, 100, 100, 1, 0,
//   0, 1, -100, 100, 100, 1, 0, 0, 1,
//   // back
//   -100, 100, 100, 0, 1, 0, 1, -100, 100, -100, 0, 1, 0, 1, -100, -100, -100, 0,
//   1, 0, 1, -100, -100, 100, 0, 1, 0, 1,
//   // left
//   100, 100, 100, 0, 0, 1, 1, 100, -100, 100, 0, 0, 1, 1, 100, -100, -100, 0, 0,
//   1, 1, 100, 100, -100, 0, 0, 1, 1,
//   // 1
//   100, 100, -100, 1, 0, 1, 1, 100, -100, -100, 1, 0, 1, 1, -100, -100, -100, 1,
//   0, 1, 1, -100, 100, -100, 1, 0, 1, 1,
//   // 2
//   -100, 100, 100, 1, 1, 0, 1, 100, 100, 100, 1, 1, 0, 1, 100, 100, -100, 1, 1,
//   0, 1, -100, 100, -100, 1, 1, 0, 1,
//   // 3
//   -100, -100, 100, 0, 1, 1, 1, -100, -100, -100, 0, 1, 1, 1, 100, -100, -100, 0,
//   1, 1, 1, 100, -100, 100, 0, 1, 1, 1,
// ];

// function generateColors(count: number) {
//   const colors = [];
//   for (let i = 0; i < count; i++) {
//     colors.push(...randomColor());
//   }

//   return colors;
// }

function getElementsCountPerVertex(attribute: string) {
  let result = 3;
  switch (attribute) {
    case "colors":
      result = 4;
      break;
    case "indices":
      result = 1;
      break;
    case "texcoords":
      result = 2;
      break;
  }
  return result;
}

var random = Math.random;
function randomColor() {
  return {
    r: random() * 255,
    g: random() * 255,
    b: random() * 255,
    a: random() * 1,
  };
}

function createColorForVertex(
  vertex: Record<string, any>,
  c?: Record<string, any>
) {
  let vertexNums = vertex.positions;
  let colors = [];
  let color = c || {
    r: 255,
    g: 0,
    b: 0,
    a: 255,
  };

  for (let i = 0; i < vertexNums.length; i++) {
    color = c || randomColor();
    colors.push(color.r, color.g, color.b, 255);
  }

  vertex.colors = new Uint8Array(colors);
  return vertex;
}

function getArrayTypeByAttribName(attribute: string) {
  switch (attribute) {
    case "colors":
      return Uint8Array;
    case "indices":
      return Uint16Array;
    default:
      return Float32Array;
  }
}

function transformIndicesToUnIndices(vertex: Record<string, any>) {
  let indices = vertex.indices;
  let vertexsCount = indices.length;
  let destVertex: Record<string, any> = {};

  Object.keys(vertex).forEach(function (attribute) {
    if (attribute == "indices") {
      return;
    }
    let src = vertex[attribute];
    let elementsPerVertex = getElementsCountPerVertex(attribute);
    let dest = [];
    let index = 0;
    for (let i = 0; i < indices.length; i++) {
      for (let j = 0; j < elementsPerVertex; j++) {
        dest[index] = src[indices[i] * elementsPerVertex + j];
        index++;
      }
    }
    let type = getArrayTypeByAttribName(attribute);
    destVertex[attribute] = new type(dest);
  });
  return destVertex;
}

export default function Sphere() {
  const cavRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const elem = cavRef.current as HTMLCanvasElement;
    const gl = getGraphContext(elem) as WebGLRenderingContext;
    const vertexShader = shaderHelper(gl, gl.VERTEX_SHADER, vertexStr);
    const fragmentShader = shaderHelper(gl, gl.FRAGMENT_SHADER, fragmentStr);
    const program = programHelper(gl, vertexShader, fragmentShader);
    gl.useProgram(program);
    // const indices = [
    //   0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12,
    //   14, 15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
    // ];
    const u_Matrix = gl.getUniformLocation(program, "u_Matrix");
    const a_Position = gl.getAttribLocation(program, "a_Position");
    const a_Color = gl.getAttribLocation(program, "a_Color");
    const a_Screen_Size = gl.getAttribLocation(program, "a_Screen_Size");
    gl.enableVertexAttribArray(a_Position);
    gl.enableVertexAttribArray(a_Color);
    const vertex = createSphere2(200, 12, 12);
    const sphere = transformIndicesToUnIndices(vertex);
    createColorForVertex(sphere);
    const { positions, colors } = sphere;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    // const indicesBuffer = gl.createBuffer();
    // gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesBuffer);
    // gl.bufferData(
    //   gl.ELEMENT_ARRAY_BUFFER,
    //   new Uint16Array(indices),
    //   gl.STATIC_DRAW
    // );
    gl.vertexAttrib3f(a_Screen_Size, elem.width, elem.height, 200);
    // console.log("Indices: " + indices.length);
    // const colors = generateColors(indices.length);
    console.log(colors);
    const colorsBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(colors), gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Color, 4, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.enable(gl.DEPTH_TEST);
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

    let xAngle = 20;
    let yAngle = 20;

    function render() {
      ++xAngle;
      ++yAngle;
      rotationX(deg2radians(xAngle), destMatrix);
      multiply(
        destMatrix,
        rotationY(deg2radians(yAngle), tempMatrix),
        destMatrix
      );
      const n = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
      for (let i = 0; i < n; ++i) {
        const info = gl.getActiveAttrib(program, i);
        console.log(info);
      }
      multiply(projectionMatrix, destMatrix, destMatrix);
      gl.uniformMatrix4fv(u_Matrix, false, destMatrix);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, positions.length / 3);
      // requestAnimationFrame(render);
    }
    render();
  }, []);

  return (
    <div style={{ margin: "120px auto" }}>
      <canvas ref={cavRef} style={{ width: 600, height: 400 }} />
    </div>
  );
}
