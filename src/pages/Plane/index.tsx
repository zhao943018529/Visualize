import React, { useRef, useState, useEffect, useCallback } from "react";
import * as twgl from "twgl.js";
import { Slider, Typography, Box } from "@mui/material";
import { createCube } from "../../utils/geometry";
import { deg2radians } from "../../utils/math";

const { m4, primitives } = twgl;

// 1.画一个平面 画一个球 2.绕x轴和饶y轴进行旋转

const VERTEX_ID = "vertex-shader";
const FRAGMENT_ID = "fragment-shader";
const COLOR_VERTEX_ID = "colorvertex-shader";
const COLOR_FRAGMENT_ID = "color-fragment-shader";

const colorVertexShaderStr = `
    attribute vec4 position;
    uniform mat4 u_projection;
    uniform mat4 u_view;
    uniform mat4 u_world;

    void main(){
        gl_Position = u_projection * u_view * u_world * position;
    }
`;

const colorFragmentShaderStr = `
    precision mediump float;
    uniform vec4 u_color;

    void main() {
        gl_FragColor = u_color;
    }
`;

const vertexShaderStr = `
    attribute vec4 position;
    attribute vec2 texcoord;
    attribute vec3 normal;

    uniform mat4 u_projectionMatrix;
    uniform mat4 u_worldMatrix;
    uniform mat4 u_transposeInverseMatrix;
    uniform mat4 u_textureMatrix;

    varying vec2 v_texCoord;
    varying vec4 v_projectedTexcoord;

    void main() {
        vec4 worldPosition = u_worldMatrix * position;
        gl_Position = u_projectionMatrix * worldPosition;
        v_texCoord = texcoord;
        v_projectedTexcoord = u_textureMatrix * worldPosition;
    }
`;

const fragmentShaderStr = `
    precision mediump float;

    varying vec2 v_texCoord;
    varying vec4 v_projectedTexcoord;

    uniform vec4 u_colorMult;
    uniform sampler2D u_texture;
    uniform sampler2D u_projectedTexture;

    void main() {
        vec3 projectedTexcoord = v_projectedTexcoord.xyz / v_projectedTexcoord.w;
        bool inRange = projectedTexcoord.x >= 0.0 
        && projectedTexcoord.x <= 1.0 
        && projectedTexcoord.y >= 0.0
        && projectedTexcoord.y <= 1.0;

        vec4 projectedTexColor = texture2D(u_projectedTexture, projectedTexcoord.xy);
        vec4 texColor = texture2D(u_texture, v_texCoord) * u_colorMult;

        float projectedAmount = inRange ? 1.0 : 0.0;

        gl_FragColor = mix(texColor, projectedTexColor, projectedAmount);
    }
`;

export default function Plane() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const planeBufferInfoRef = useRef<twgl.BufferInfo | null>(null);
  const sphereBufferInfoRef = useRef<twgl.BufferInfo | null>(null);
  const programInfoRef = useRef<twgl.ProgramInfo | null>(null);
  const programInfo2Ref = useRef<twgl.ProgramInfo | null>(null);
  const textureMapRef = useRef<{ [key: string]: WebGLTexture }>({});

  const [xAngle, setXAngle] = useState<number>(0);
  const [yAngle, setYAngle] = useState<number>(0);
  const [posX, setPosX] = useState<number>(3.5);
  const [posY, setPoxY] = useState<number>(4.4);
  const [posZ, setPoxZ] = useState<number>(4.7);
  const [cuboidData] = useState<any>(() => createCube(1, 1, 2));

  const handleXAngleChange = useCallback(
    (event: any, angle: number | number[]) => {
      setXAngle(angle as number);
    },
    []
  );
  const handleYAngleChange = useCallback(
    (event: any, angle: number | number[]) => {
      setYAngle(angle as number);
    },
    []
  );
  const handlePosXChange = useCallback(
    (event: any, angle: number | number[]) => {
      setPosX(angle as number);
    },
    []
  );
  const handlePosYChange = useCallback(
    (event: any, angle: number | number[]) => {
      setPoxY(angle as number);
    },
    []
  );
  const handlePosZChange = useCallback(
    (event: any, angle: number | number[]) => {
      setPoxZ(angle as number);
    },
    []
  );

  const drawScene = useCallback(() => {}, []);

  const render = useCallback((x, y, a, b, c) => {
    const gl = glRef.current as WebGLRenderingContext;
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const programInfo = programInfoRef.current as twgl.ProgramInfo;
    const programInfo2 = programInfo2Ref.current as twgl.ProgramInfo;
    const planeBufferInfo = planeBufferInfoRef.current as twgl.BufferInfo;
    const sphereBufferInfo = sphereBufferInfoRef.current as twgl.BufferInfo;
    const width = gl.canvas.width;
    const height = gl.canvas.height;
    const fieldOfViewRadians = deg2radians(60);
    const aspect = width / height;
    const projectionMatrix = m4.perspective(
      fieldOfViewRadians,
      aspect,
      1,
      2000
    );

    const cameraPos = [2.75, 5, 7];
    const target = [0, 0, 0];
    const up = [0, 1, 0];

    const cameraMatrix = m4.lookAt(cameraPos, target, up);
    const viewMatrix = m4.inverse(cameraMatrix);

    const worldMatrix = m4.multiply(
      m4.rotationX(deg2radians(x)),
      m4.rotationY(deg2radians(y))
    );

    const inverseTransposeMatrix = m4.transpose(m4.inverse(worldMatrix));

    const projectionViewMatrix = m4.multiply(projectionMatrix, viewMatrix);

    const { texture, projection } = textureMapRef.current;
    const textureWorldMatrix = m4.lookAt([a, b, c], [0.8, 0, 4.7], [0, 1, 0]);
    const textureWorldViewMatrix = m4.inverse(textureWorldMatrix);

    const uniformBufferInfo = {
      u_projectionMatrix: projectionViewMatrix,
      u_worldMatrix: worldMatrix,
      u_colorMult: [1, 1, 1, 1],
      u_transposeInverseMatrix: inverseTransposeMatrix,
      u_texture: texture,
      u_textureMatrix: textureWorldViewMatrix,
      u_projectedTexture: projection,
    };
    gl.useProgram(programInfo.program);
    twgl.setUniforms(programInfo, uniformBufferInfo);
    twgl.setBuffersAndAttributes(gl, programInfo, planeBufferInfo);
    gl.drawElements(
      gl.TRIANGLES,
      planeBufferInfo.numElements,
      gl.UNSIGNED_SHORT,
      0
    );
    const sphereUniforms = {
      ...uniformBufferInfo,
      u_worldMatrix: m4.translate(uniformBufferInfo.u_worldMatrix, [2, 4, 2]),
    };
    twgl.setUniforms(programInfo, sphereUniforms);
    twgl.setBuffersAndAttributes(gl, programInfo, sphereBufferInfo);
    gl.drawElements(
      gl.TRIANGLES,
      sphereBufferInfo.numElements,
      gl.UNSIGNED_SHORT,
      0
    );
    const cuboidBufferInfo = twgl.createBufferInfoFromArrays(gl, {
      position: cuboidData.positions,
      // [
      //   0, 0, -1, 1, 0, -1, 0, 1, -1, 1, 1, -1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1,
      //   1,
      // ],
      indices: cuboidData.indices,
      // [
      //   0, 1, 1, 3, 3, 2, 2, 0,

      //   4, 5, 5, 7, 7, 6, 6, 4,

      //   0, 4, 1, 5, 3, 7, 2, 6,
      // ],
    });
    let textureMatrix = m4.identity();
    textureMatrix = m4.translate(textureMatrix, [0.5, 0.5, 0.5]);
    textureMatrix = m4.multiply(
      m4.scale(textureMatrix, [0.5, 0.5, 0.5]),
      projectionMatrix
    );
    const colorUniforms = {
      u_projection: textureMatrix,
      u_view: viewMatrix,
      u_world: m4.scale(textureWorldMatrix, [1, 1, 1000]),
      u_color: [0, 0, 0, 1],
    };
    gl.useProgram(programInfo2.program);
    twgl.setUniforms(programInfo2, colorUniforms);
    twgl.setBuffersAndAttributes(gl, programInfo2, cuboidBufferInfo);
    gl.drawElements(
      gl.LINES,
      cuboidBufferInfo.numElements,
      gl.UNSIGNED_SHORT,
      0
    );
  }, []);

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem);
    glRef.current = gl;
    const programInfo = twgl.createProgramInfo(gl, [VERTEX_ID, FRAGMENT_ID]);
    programInfoRef.current = programInfo;
    const programInfo2 = twgl.createProgramInfo(gl, [
      COLOR_VERTEX_ID,
      COLOR_FRAGMENT_ID,
    ]);
    programInfo2Ref.current = programInfo2;
    const planeBufferInfo = primitives.createPlaneBufferInfo(gl, 20, 20, 1, 1);
    planeBufferInfoRef.current = planeBufferInfo;
    // const arrays = primitives.createSphereVertices(30,20,20);
    const sphereBufferInfo = primitives.createSphereBufferInfo(gl, 2, 12, 6);
    sphereBufferInfoRef.current = sphereBufferInfo;
    textureMapRef.current = twgl.createTextures(gl, {
      texture: {
        mag: gl.NEAREST,
        min: gl.LINEAR,
        format: gl.LUMINANCE,
        src: new Uint8Array([
          // data
          0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xcc, 0xff, 0xcc,
          0xff, 0xcc, 0xff, 0xcc, 0xff, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc,
          0xff, 0xcc, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xff,
          0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xcc, 0xff, 0xcc, 0xff,
          0xcc, 0xff, 0xcc, 0xff, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff,
          0xcc, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff, 0xcc, 0xff,
        ]),
      },
      projection: {
        src: "/f-texture.png",
      },
    });
  }, []);

  useEffect(() => {
    render(xAngle, yAngle, posX, posY, posZ);
  }, [xAngle, yAngle, posX, posY, posZ]);

  return (
    <Box sx={{ position: "relative" }}>
      <Box sx={{ position: "absolute", width: 240, right: 0 }}>
        <Slider
          value={xAngle}
          onChange={handleXAngleChange}
          min={-360}
          max={360}
        />
        <Slider
          value={yAngle}
          onChange={handleYAngleChange}
          min={0}
          max={360}
        />
        <Slider
          value={yAngle}
          onChange={handleYAngleChange}
          min={0}
          max={360}
        />
        <Slider value={posX} onChange={handlePosXChange} min={-20} max={100} />
        <Slider value={posY} onChange={handlePosYChange} min={-20} max={100} />
        <Slider value={posZ} onChange={handlePosZChange} min={-20} max={100} />
      </Box>
      <canvas ref={cavRef} width={1000} height={800}></canvas>
      <script id={VERTEX_ID} type="notjs">
        {vertexShaderStr}
      </script>
      <script id={FRAGMENT_ID} type="notjs">
        {fragmentShaderStr}
      </script>
      <script id={COLOR_VERTEX_ID} type="notjs">
        {colorVertexShaderStr}
      </script>
      <script id={COLOR_FRAGMENT_ID} type="notjs">
        {colorFragmentShaderStr}
      </script>
    </Box>
  );
}
