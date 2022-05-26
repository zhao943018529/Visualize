import React, { useRef, useEffect } from "react";
import {
  getGraphContext,
  shaderHelper,
  programHelper,
} from "../../utils/index";
import {
  perspective,
  identity,
  lookAt,
  inverse,
  rotationZ,
  rotationY,
  multiply,
  getMatrixFromEuler,
} from "../../utils/matrix";
import { transformIndicesToUnIndices } from "../../utils/geometry";
import Vector3 from "../../utils/vec3";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const CUBE_FACES_INDICES = [
  // 前面
  [0, 1, 2, 3],
  // 右面
  [1, 5, 6, 2],
  // 后面
  [5, 4, 7, 6],
  // 左面
  [4, 0, 3, 7],
  // 上面
  [4, 5, 1, 0],
  // 下面
  [7, 6, 2, 3],
];

function createCube(w: number, h: number, z: number) {
  const xLen = w / 2;
  const yLen = h / 2;
  const zLen = z / 2;
  const positionInput = [
    [-xLen, yLen, zLen],
    [xLen, yLen, zLen],
    [xLen, -yLen, zLen],
    [-xLen, -yLen, zLen],
    [-xLen, yLen, -zLen],
    [xLen, yLen, -zLen],
    [xLen, -yLen, -zLen],
    [-xLen, -yLen, -zLen],
  ];
  const colorInput = [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 255, 0, 255],
    [0, 255, 255, 255],
    [255, 0, 255, 255],
  ];
  const normalsInput = [
    // 前面
    [0, 0, 1],
    // 右面
    [1, 0, 0],
    // 后面
    [0, 0, -1],
    // 左面
    [-1, 0, 0],
    // 上面
    [0, 1, 0],
    // 下面
    [0, -1, 0],
  ];

  const positions = [];
  const indices = [];
  const colors = [];
  const normals = [];
  for (let i = 0; i < 6; ++i) {
    const currentFace = CUBE_FACES_INDICES[i];
    const faceColor = colorInput[i];
    for (let j = 0; j < 4; ++j) {
      positions.push(...positionInput[currentFace[j]]);
      colors.push(...faceColor);
      normals.push(...normalsInput[i]);
    }
    const offset = i * 4;
    indices.push(offset + 0, offset + 3, offset + 1);
    indices.push(offset + 1, offset + 3, offset + 2);
  }

  return {
    colors: new Uint8Array(colors),
    positions: new Float32Array(positions),
    indices: new Uint16Array(indices),
    normals: new Float32Array(normals),
  };
}

const vertexStr = `
    precision mediump float;

    attribute vec3 a_Position;
    attribute vec4 a_Color;
    varying vec4 v_Color;
    uniform mat4 u_Matrix;

    void main() {
        gl_Position = u_Matrix * vec4(a_Position, 1);
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

export default function Euler() {
  const cavRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = getGraphContext(cavElem) as WebGLRenderingContext;
    const vertexShader = shaderHelper(gl, gl.VERTEX_SHADER, vertexStr);
    const fragmentShader = shaderHelper(gl, gl.FRAGMENT_SHADER, fragmentStr);
    const program = programHelper(gl, vertexShader, fragmentShader);
    gl.useProgram(program);
    const fieldOfViewRadians = 60;
    const aspect = cavElem.width / cavElem.height;
    const projectionMatrix = perspective(
      fieldOfViewRadians,
      aspect,
      2,
      900,
      null
    );
    const cameraPosition = new Vector3(0, 0, 10);
    const upDir = new Vector3(0, 1, 0);
    const target = new Vector3(0, 0, 0);
    const cameraMatrix = lookAt(cameraPosition, target, upDir, null);
    const viewMatrix = inverse(cameraMatrix, null);
    let cube = createCube(4, 4, 4) as any;
    cube = transformIndicesToUnIndices(cube);
    const { colors, indices, normals, positions } = cube;
    const a_Position = gl.getAttribLocation(program, "a_Position");
    const a_Color = gl.getAttribLocation(program, "a_Color");
    const u_Matrix = gl.getUniformLocation(program, "u_Matrix");
    gl.enableVertexAttribArray(a_Position);
    gl.enableVertexAttribArray(a_Color);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);
    gl.vertexAttribPointer(a_Color, 4, gl.UNSIGNED_BYTE, false, 0, 0);

    let startX = 0;
    let startY = 0;

    function handleMouseup() {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleMouseup);
    }

    function handleStart(evt: MouseEvent) {
      startX = evt.clientX;
      startY = evt.clientY;
      document.body.addEventListener("mousemove", handleMove);
      document.body.addEventListener("mouseup", handleMouseup);
    }
    const radian = Math.PI / 180;
    const factor = 0.6;
    let x = 0;
    let y = 0;
    let currentMatrix = identity(null);
    let tempMatrix = identity(null);
    let lastMatrix = identity(null);
    function handleMove(evt: MouseEvent) {
      x = evt.clientX - startX;
      y = evt.clientY - startY;
      const l = Math.sqrt(x * x + y * y);
      if (l == 0) {
        return;
      }
      let euler = {
        x: factor * x * radian,
        y: factor * y * radian,
        z: 0,
      };

      tempMatrix = getMatrixFromEuler(euler);
      currentMatrix = multiply(tempMatrix, lastMatrix, currentMatrix);
      render();
    }
    document.body.addEventListener("mousedown", handleStart);
    gl.clearColor(0, 0, 0, 1.0);

    function render() {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const worldMatrix = multiply(viewMatrix, currentMatrix, null);
      gl.uniformMatrix4fv(
        u_Matrix,
        false,
        multiply(projectionMatrix, worldMatrix, null)
      );
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.CULL_FACE);
      gl.drawArrays(gl.TRIANGLES, 0, positions.length / 3);
    }
    render();
  }, []);

  return (
    <div>
      <canvas ref={cavRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
    </div>
  );
}
