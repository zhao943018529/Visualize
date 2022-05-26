import React, { useEffect, useState, useRef, useCallback } from "react";
import chroma, { gl } from "chroma-js";
import { Box } from "@mui/material";
import * as twgl from "twgl.js";

import { deg2radians } from "../../utils/math";

const { primitives, m4 } = twgl;

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 800;
const VERTEX_ID = "vertex-id";
const FRAGMENT_ID = "fragment-id";

const PICKING_VERTEX_ID = "picking-vertex-id";
const PICKING_FRAGMENT_ID = "picking-fragment-id";

const vertexStr = `
    attribute vec4 position;

    uniform mat4 u_viewProjection;
    uniform mat4 u_world;

    void main() {
        gl_Position =u_viewProjection * u_world * position;
    }
`;
const fragmentStr = `
    precision mediump float;

    uniform vec4 u_colorMult;
    uniform vec4 u_color;

    void main() {
        gl_FragColor = u_color * u_colorMult;
    }
`;
const pickingVertexStr = `
    attribute vec4 position;

    uniform mat4 u_viewProjection;
    uniform mat4 u_world;

    void main() {
        gl_Position = u_viewProjection * u_world * position;
    }
`;
const pickingFragmentStr = `
    precision mediump float;

    uniform vec4 u_id;

    void main() {
        gl_FragColor = u_id;
    }
`;

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function eMod(x: number, n: number) {
  return x >= 0 ? x % n : (n - (-x % n)) % n;
}

const defaultColors = chroma
  .scale(["#fafa6e", "#2A4858"])
  .mode("rgb")
  .colors(10)
  .map((item) => chroma(item).rgba());
console.log(defaultColors);

interface ObjectInfo {
  uniforms: Record<string, any>;
  bufferInfo: twgl.BufferInfo;
  translation: number[];
  xRotationSpeed: number;
  yRotationSpeed: number;
}

interface PickingInfo {
  oldPickColor: string | null;
  oldPickNdx: number;
  id: number;
}

export default function Picking() {
  const cavRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext>();
  const programInfosRef = useRef<{ [key: string]: twgl.ProgramInfo }>({});
  const drawObjectsRef = useRef<ObjectInfo[]>([]);
  const [selected, setSelected] = useState<number[]>([-1, -1]);
  const colorRef = useRef<string | null>(null);
  const frameBufferRef = useRef<WebGLFramebuffer | null>(null);
  const texturesRef = useRef<Record<string, WebGLTexture>>({});
  const depthRenderBufferRef = useRef<WebGLRenderbuffer | null>(null);
  const pickingRef = useRef<PickingInfo>({
    oldPickColor: null,
    oldPickNdx: -1,
    id: 0,
  });
  const pixelsObjRef = useRef<Record<string, any>>({
    pixelX: 0,
    pixelY: 0,
  });

  const drawObjectsFunc = useCallback(
    (
      objectsToDraw: ObjectInfo[],
      gl: WebGLRenderingContext,
      programInfo: twgl.ProgramInfo
    ) => {
      gl.useProgram(programInfo.program);
      objectsToDraw.forEach((obj) => {
        twgl.setUniforms(programInfo, obj.uniforms);
        twgl.setBuffersAndAttributes(gl, programInfo, obj.bufferInfo);
        twgl.drawBufferInfo(gl, obj.bufferInfo, gl.TRIANGLES);
      }, []);
    },
    []
  );

  const computeMatrix = useCallback(
    (translation: twgl.v3.Vec3, xRotation: number, yRotation: number) => {
      let matrix = m4.translation(translation);
      matrix = m4.rotateX(matrix, xRotation);

      return m4.rotateY(matrix, yRotation);
    },
    []
  );

  useEffect(() => {
    const cavElem = cavRef.current as HTMLCanvasElement;
    const gl = twgl.getWebGLContext(cavElem) as WebGLRenderingContext;
    glRef.current = gl;
    const programInfo = twgl.createProgramInfo(gl, [VERTEX_ID, FRAGMENT_ID]);
    const pickingProgramInfo = twgl.createProgramInfo(gl, [
      PICKING_VERTEX_ID,
      PICKING_FRAGMENT_ID,
    ]);
    programInfosRef.current = {
      programInfo,
      pickingProgramInfo,
    };
    const cubeBufferInfo = primitives.createCubeBufferInfo(gl, 10);
    const sphereBufferInfo = primitives.createSphereBufferInfo(gl, 10, 30, 30);
    const cylinderBufferInfo = primitives.createCylinderBufferInfo(
      gl,
      10,
      20,
      10,
      10
    );
    const geometries: twgl.BufferInfo[] = [
      cubeBufferInfo,
      sphereBufferInfo,
      cylinderBufferInfo,
    ];
    const drawObjects: ObjectInfo[] = [];
    const objectNum = 200;
    const baseHue = rand(0, 360);
    for (let i = 0; i < objectNum; i++) {
      let ii = i + 1;
      drawObjects.push({
        bufferInfo: geometries[i % 3],
        uniforms: {
          u_color: [0.4, 0.1, 1, 1],
          u_colorMult: chroma
            .hsv(eMod(baseHue + rand(0, 120), 360), rand(0.5, 1), rand(0.5, 1))
            .gl(),
          u_id: [
            ((ii >> 0) & 0xff) / 0xff,
            ((ii >> 8) & 0xff) / 0xff,
            ((ii >> 16) & 0xff) / 0xff,
            ((ii >> 24) & 0xff) / 0xff,
          ],
        },
        translation: [rand(-100, 100), rand(-100, 100), rand(-150, -50)],
        xRotationSpeed: rand(0.8, 1.2),
        yRotationSpeed: rand(0.8, 1.2),
      });
    }
    drawObjectsRef.current = drawObjects;
    const targetTexture = gl.createTexture() as WebGLTexture;
    gl.bindTexture(gl.TEXTURE_2D, targetTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    texturesRef.current = { targetTexture };
    const depthBuffer = gl.createRenderbuffer();
    depthRenderBufferRef.current = depthBuffer;
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);

    const frameBuffer = gl.createFramebuffer();
    frameBufferRef.current = frameBuffer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    const level = 0;
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      targetTexture,
      level
    );
    gl.framebufferRenderbuffer(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.RENDERBUFFER,
      depthBuffer
    );
    requestAnimationFrame(drawScene);
  }, []);

  const handleMouseMove = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      const cavElem = cavRef.current as HTMLCanvasElement;
      const rect = cavElem.getBoundingClientRect();
      const mouseX = evt.clientX - rect.left;
      const mouseY = evt.clientY - rect.top;
      const pixelX = (mouseX * cavElem.width) / cavElem.clientWidth;
      const pixelY =
        cavElem.height - (mouseY * cavElem.height) / cavElem.clientHeight - 1;
      pixelsObjRef.current = {
        pixelX,
        pixelY,
      };
    },
    []
  );

  const drawScene = useCallback((time: number) => {
    time *= 0.0005;

    const gl = glRef.current as WebGLRenderingContext;
    const frameBuffer = frameBufferRef.current;
    const { targetTexture } = texturesRef.current;
    const depthRenderBuffer = depthRenderBufferRef.current;
    const { programInfo, pickingProgramInfo } = programInfosRef.current;

    gl.bindTexture(gl.TEXTURE_2D, targetTexture);
    const level = 0;
    const internalFormat = gl.RGBA;
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;
    const data = null;
    const { width, height } = gl.canvas;

    gl.texImage2D(
      gl.TEXTURE_2D,
      level,
      internalFormat,
      width,
      height,
      0,
      format,
      type,
      data
    );

    gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderBuffer);
    gl.renderbufferStorage(
      gl.RENDERBUFFER,
      gl.DEPTH_COMPONENT16,
      width,
      height
    );
    const viewProjectionMatrix = m4.identity();
    drawObjectsRef.current.forEach((obj) => {
      obj.uniforms.u_world = computeMatrix(
        obj.translation,
        obj.xRotationSpeed * time,
        obj.yRotationSpeed * time
      );
      obj.uniforms.u_viewProjection = viewProjectionMatrix;
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    const canvasWidth = gl.canvas.width;
    const canvasHeight = gl.canvas.height;
    gl.viewport(0, 0, canvasWidth, canvasHeight);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const fieldOfViewYInRadians = deg2radians(60);
    const aspect = canvasWidth / canvasHeight;
    const near = 1;
    const far = 2000;
    const top = Math.tan(fieldOfViewYInRadians * 0.5) * near;
    const bottom = -top;
    const right = top * aspect;
    const left = bottom * aspect;
    const cwidth = Math.abs(right - left);
    const cheight = Math.abs(top - bottom);

    const up = [0, 1, 0];
    const target = [0, 0, 0];
    const cameraPosition = [0, 0, 100];
    const cameraMatrix = m4.lookAt(cameraPosition, target, up);
    const viewMatrix = m4.inverse(cameraMatrix);

    const { oldPickColor, oldPickNdx } = pickingRef.current;
    const { pixelX, pixelY } = pixelsObjRef.current;
    const subLeft = left + (pixelX * cwidth) / canvasWidth;
    const subBottom = bottom + (pixelY * cheight) / canvasHeight;
    const subWidth = 1 / canvasWidth;
    const subHeight = 1 / canvasHeight;
    let projectionMatrix = m4.frustum(
      subLeft,
      subLeft + subWidth,
      subBottom,
      subBottom + subHeight,
      near,
      far
    );
    m4.multiply(projectionMatrix, viewMatrix, viewProjectionMatrix);
    drawObjectsFunc(drawObjectsRef.current, gl, pickingProgramInfo);
    const curData = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, curData);
    const id =
      curData[0] + (curData[1] << 8) + (curData[2] << 16) + (curData[3] << 24);
    if (oldPickNdx >= 0) {
      const oldCurrent = drawObjectsRef.current[oldPickNdx];
      oldCurrent.uniforms.u_colorMult = oldPickColor;
    }
    if (id > 0) {
      const pickNdx = id - 1;
      pickingRef.current.oldPickNdx = pickNdx;
      const currentObj = drawObjectsRef.current[pickNdx];
      pickingRef.current.oldPickColor = currentObj.uniforms.u_colorMult;
      currentObj.uniforms.u_colorMult = [1, 0, 0, 1];
    }
    projectionMatrix = m4.perspective(fieldOfViewYInRadians, aspect, near, far);
    m4.multiply(projectionMatrix, viewMatrix, viewProjectionMatrix);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    drawObjectsFunc(drawObjectsRef.current, gl, programInfo);

    requestAnimationFrame(drawScene);
  }, []);

  return (
    <Box sx={{ position: "relative" }}>
      <canvas
        ref={cavRef}
        width={CANVAS_WIDTH}
        onMouseMove={handleMouseMove}
        height={CANVAS_HEIGHT}
      ></canvas>
      <script id={VERTEX_ID} type="notjs">
        {vertexStr}
      </script>
      <script id={FRAGMENT_ID} type="notjs">
        {fragmentStr}
      </script>
      <script id={PICKING_VERTEX_ID} type="notjs">
        {pickingVertexStr}
      </script>
      <script id={PICKING_FRAGMENT_ID} type="notjs">
        {pickingFragmentStr}
      </script>
    </Box>
  );
}
