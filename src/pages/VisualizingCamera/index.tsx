import React, { useRef, useEffect, useCallback, useState } from "react";
import * as twgl from "twgl.js";
import { Slider, Box } from "@mui/material";

import { deg2radians } from "../../utils/math";
import { createTorus } from "../../utils/geometry";

import styles from "./index.module.scss";

const { primitives, m4 } = twgl;

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;

const VERTEX_ID = "vertex_id";
const FRAGMENT_ID = "fragment_id";

const vertexStr = `
    attribute vec4 position;
    attribute vec3 normal;

    uniform mat4 u_matrix;
    uniform mat4 u_world;

    varying vec3 v_color;

    void main() {
        gl_Position = u_matrix * u_world * position;
        v_color = normal * 0.5 + 0.5;
    }
`;

const fragmentStr = `
    precision mediump float;

    varying vec3 v_color;

    void main() {
        gl_FragColor= vec4(v_color, 1);
    }
`;
const SOLID_VERTEX_ID = "solid_vertex_id";
const SOLID_FRAGMENT_ID = "solid_fragment_id";

const solidVertexStr = `
    attribute vec4 position;

    uniform mat4 u_matrix;
    uniform mat4 u_world;

    void main() {
        gl_Position = u_matrix * u_world * position;
    }
`;

const solidFragmentStr = `
    precision mediump float;

    uniform vec4 u_color;

    void main() {
        gl_FragColor= u_color;
    }
`;

function createClipspaceCubeBufferInfo(gl: WebGLRenderingContext) {
  // first let's add a cube. It goes from 1 to 3
  // because cameras look down -Z so we want
  // the camera to start at Z = 0. We'll put a
  // a cone in front of this cube opening
  // toward -Z
  const positions = [
    -1,
    -1,
    -1, // cube vertices
    1,
    -1,
    -1,
    -1,
    1,
    -1,
    1,
    1,
    -1,
    -1,
    -1,
    1,
    1,
    -1,
    1,
    -1,
    1,
    1,
    1,
    1,
    1,
  ];
  const indices = [
    0,
    1,
    1,
    3,
    3,
    2,
    2,
    0, // cube indices
    4,
    5,
    5,
    7,
    7,
    6,
    6,
    4,
    0,
    4,
    1,
    5,
    3,
    7,
    2,
    6,
  ];
  return twgl.createBufferInfoFromArrays(gl, {
    position: {
      data: positions,
      numComponents: 3,
    },
    indices: {
      data: indices,
      numComponents: 2,
    },
  });
}

interface ObjectDrawInfo {
  bufferInfo: twgl.BufferInfo;
  matrix: twgl.m4.Mat4;
}

export default function VisualizeCamera() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext>();
  const programInfoRef = useRef<twgl.ProgramInfo>();
  const solidProgramInfoRef = useRef<twgl.ProgramInfo>();

  const geometriesRef = useRef<{ [key: string]: twgl.BufferInfo }>({});

  const [cameraPos, setCameraPos] = useState<number[]>([0, 0, -200]);

  const drawScene = useCallback(
    (
      gl: WebGLRenderingContext,
      programInfo: twgl.ProgramInfo,
      projectionMatrix: twgl.m4.Mat4,
      cameraMatrix: twgl.m4.Mat4,
      objectsToDraw: ObjectDrawInfo[]
    ) => {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const viewMatrix = m4.inverse(cameraMatrix);
      gl.useProgram(programInfo.program);
      const projectionViewMatrix = m4.multiply(projectionMatrix, viewMatrix);
      objectsToDraw.forEach(({ bufferInfo, matrix }) => {
        twgl.setUniforms(programInfo, {
          u_world: matrix,
          u_matrix: projectionViewMatrix,
        });
        twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
        twgl.drawBufferInfo(gl, bufferInfo);
      });
    },
    []
  );

  const render = useCallback((cPosition: number[]) => {
    const gl = glRef.current as WebGLRenderingContext;
    const programInfo = programInfoRef.current as twgl.ProgramInfo;
    const solidProgramInfo = solidProgramInfoRef.current as twgl.ProgramInfo;
    const { cubeBufferInfo, cylinderBufferInfo, frustumBufferInfo } =
      geometriesRef.current;
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.SCISSOR_TEST);
    const effectiveWidth = gl.canvas.clientWidth / 2;
    const aspect = effectiveWidth / gl.canvas.clientHeight;
    const near = 10;
    const far = 600;
    const perspectiveProjectionMatrix = m4.perspective(
      deg2radians(60),
      aspect,
      near,
      far
    );

    const target = [0, 0, 0];
    const up = [0, 1, 0];
    const cameraPosition = cPosition;
    const camera1 = m4.lookAt(cameraPosition, target, up);
    const { width, height } = gl.canvas;
    const leftWidth = (width / 2) | 0;
    gl.viewport(0, 0, leftWidth, height);
    gl.scissor(0, 0, leftWidth, height);
    gl.clearColor(1, 0.8, 0.8, 1);
    drawScene(gl, programInfo, perspectiveProjectionMatrix, camera1, [
      { bufferInfo: cylinderBufferInfo, matrix: m4.identity() },
    ]);
    const perspectiveProjectionMatrix2 = m4.perspective(
      deg2radians(60),
      aspect,
      1,
      2000
    );

    const rightWidth = width - leftWidth;
    gl.viewport(leftWidth, 0, rightWidth, height);
    gl.scissor(leftWidth, 0, rightWidth, height);
    gl.clearColor(0.8, 0.8, 1, 1);

    const cameraPosition2 = [-600, 400, -400];
    const cameraMatrix2 = m4.lookAt(cameraPosition2, target, up);
    drawScene(gl, programInfo, perspectiveProjectionMatrix2, cameraMatrix2, [
      { bufferInfo: cylinderBufferInfo, matrix: m4.identity() },
    ]);

    const uMatrix = m4.multiply(
      perspectiveProjectionMatrix2,
      m4.inverse(cameraMatrix2)
    );
    gl.useProgram(solidProgramInfo.program);
    twgl.setBuffersAndAttributes(gl, solidProgramInfo, cubeBufferInfo);
    twgl.setUniforms(solidProgramInfo, {
      u_color: [0, 0, 0, 1],
      u_world: m4.multiply(camera1, m4.scaling([10, 10, 10])),
      u_matrix: uMatrix,
    });
    twgl.drawBufferInfo(gl, cubeBufferInfo, gl.LINES);

    twgl.setBuffersAndAttributes(gl, solidProgramInfo, frustumBufferInfo);
    twgl.setUniforms(solidProgramInfo, {
      u_matrix: uMatrix,
      u_color: [0, 0, 0, 1],
      u_world: m4.multiply(camera1, m4.inverse(perspectiveProjectionMatrix)),
    });
    twgl.drawBufferInfo(gl, frustumBufferInfo, gl.LINES);
  }, []);

  const handleXChange = useCallback((event, newValue) => {
    setCameraPos((prev) => [newValue, prev[1], prev[2]]);
  }, []);
  const handleYChange = useCallback((event, newValue) => {
    setCameraPos((prev) => [prev[0], newValue, prev[2]]);
  }, []);
  const handleZChange = useCallback((event, newValue) => {
    setCameraPos((prev) => [prev[0], prev[1], newValue]);
  }, []);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem) as WebGLRenderingContext;
    glRef.current = gl;
    const programInfo = twgl.createProgramInfo(gl, [VERTEX_ID, FRAGMENT_ID]);
    programInfoRef.current = programInfo;
    const solidProgramInfo = twgl.createProgramInfo(gl, [
      SOLID_VERTEX_ID,
      SOLID_FRAGMENT_ID,
    ]);
    solidProgramInfoRef.current = solidProgramInfo;
    const torusInfo = createTorus(100, 100, 20, 16);
    geometriesRef.current = {
      frustumBufferInfo: createClipspaceCubeBufferInfo(gl),
      cubeBufferInfo: createClipspaceCubeBufferInfo(gl),
      cylinderBufferInfo: twgl.createBufferInfoFromArrays(gl, {
        position: {
          data: torusInfo.position,
          numComponents: 3,
        },
        indices: torusInfo.indices,
        normal: {
          data: torusInfo.normal,
          numComponents: 3,
        },
      }),
      //   cylinderBufferInfo: primitives.createCylinderBufferInfo(
      //     gl,
      //     10,
      //     10,
      //     10,
      //     10
      //   ),
    };
    // render(cameraPos);
  }, []);
  useEffect(() => {
    render(cameraPos);
  }, [cameraPos]);

  return (
    <div className={styles.container}>
      <Box sx={{ position: "absolute", width: 240, top: 0, left: 0 }}>
        <Slider
          value={cameraPos[0]}
          onChange={handleXChange}
          min={-200}
          max={200}
        />
        <Slider
          value={cameraPos[1]}
          onChange={handleYChange}
          min={-200}
          max={200}
        />
        <Slider
          value={cameraPos[2]}
          onChange={handleZChange}
          min={-200}
          max={200}
        />
      </Box>
      <canvas ref={cavRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
      <script id={VERTEX_ID} type="notjs">
        {vertexStr}
      </script>
      <script id={FRAGMENT_ID} type="notjs">
        {fragmentStr}
      </script>
      <script id={SOLID_VERTEX_ID} type="notjs">
        {solidVertexStr}
      </script>
      <script id={SOLID_FRAGMENT_ID} type="notjs">
        {solidFragmentStr}
      </script>
    </div>
  );
}
